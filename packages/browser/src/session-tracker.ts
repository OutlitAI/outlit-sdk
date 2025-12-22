import { type EngagementEvent, buildEngagementEvent } from "@outlit/core"

// ============================================
// SESSION TRACKER
// ============================================

/**
 * Default idle timeout in milliseconds (30 seconds).
 * After this period of no user interaction, the user is considered idle.
 */
const DEFAULT_IDLE_TIMEOUT = 30000

/**
 * Session timeout in milliseconds (30 minutes).
 * After this period of inactivity, a new session ID is generated.
 */
const SESSION_TIMEOUT = 30 * 60 * 1000

/**
 * Interval for updating active time (1 second).
 */
const TIME_UPDATE_INTERVAL = 1000

/**
 * Minimum threshold to consider an engagement event spurious (50ms).
 * Events with BOTH activeTimeMs < 50ms AND totalTimeMs < 50ms are likely
 * caused by browser visibility quirks during page load and should be skipped.
 * This prevents emitting events with activeTimeMs=1ms while still allowing
 * legitimate events where the user was on the page for a meaningful duration.
 */
const MIN_SPURIOUS_THRESHOLD = 50

/**
 * Minimum time on a page before engagement can be emitted (500ms).
 * This prevents spurious engagement events when visibility toggles occur
 * shortly after SPA navigation (e.g., Framer page transitions).
 * Without this, navigating from /terms to / and then quickly toggling
 * visibility would incorrectly emit engagement for "/" immediately.
 */
const MIN_PAGE_TIME_FOR_ENGAGEMENT = 500

/**
 * Storage keys for session data in sessionStorage.
 */
const SESSION_ID_KEY = "outlit_session_id"
const SESSION_LAST_ACTIVITY_KEY = "outlit_session_last_activity"

// ============================================
// TYPES
// ============================================

interface SessionState {
  /** Full URL when the session started (used for engagement event) */
  currentUrl: string
  /** Path portion of the URL */
  currentPath: string
  /** Timestamp when user entered the current page */
  pageEntryTime: number
  /** Last timestamp when we recorded activity */
  lastActiveTime: number
  /** Accumulated active time in milliseconds */
  activeTimeMs: number
  /** Is the tab currently visible? */
  isPageVisible: boolean
  /** Has the user interacted recently (within idle timeout)? */
  isUserActive: boolean
  /** Timeout ID for idle detection */
  idleTimeoutId: ReturnType<typeof setTimeout> | null
  /** Session ID for grouping engagement events */
  sessionId: string
  /** Whether we've already emitted an engagement event for this page session */
  hasEmittedEngagement: boolean
}

export interface SessionTrackerOptions {
  /** Callback to emit engagement events (typically Tracker.enqueue) */
  onEngagement: (event: EngagementEvent) => void
  /** Idle timeout in milliseconds. Default: 30000 (30s) */
  idleTimeout?: number
}

// ============================================
// SESSION TRACKER CLASS
// ============================================

export class SessionTracker {
  private state: SessionState
  private options: SessionTrackerOptions
  private idleTimeout: number
  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null
  private boundHandleActivity: () => void
  private boundHandleVisibilityChange: () => void

  constructor(options: SessionTrackerOptions) {
    this.options = options
    this.idleTimeout = options.idleTimeout ?? DEFAULT_IDLE_TIMEOUT

    // Initialize state for current page (including session ID)
    this.state = this.createInitialState()

    // Bind event handlers
    this.boundHandleActivity = this.handleActivity.bind(this)
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this)

    // Set up event listeners
    this.setupEventListeners()

    // Start time update interval
    this.startTimeUpdateInterval()
  }

  /**
   * Get the current session ID.
   */
  getSessionId(): string {
    return this.state.sessionId
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Emit an engagement event for the current page session.
   * Called by Tracker on exit events and SPA navigation.
   *
   * This method:
   * 1. Finalizes any pending active time
   * 2. Creates and emits the engagement event (if meaningful)
   * 3. Resets state for the next session
   */
  emitEngagement(): void {
    // 1. Check if we've already handled exit for this page session (deduplication)
    // This prevents duplicate events from multiple exit handlers (visibilitychange,
    // pagehide, beforeunload) firing for the same page exit.
    if (this.state.hasEmittedEngagement) {
      return
    }

    // 2. Mark as handled FIRST to prevent any concurrent/reentrant calls
    this.state.hasEmittedEngagement = true

    // 3. Finalize any pending active time
    this.updateActiveTime()

    // 4. Create and emit event (only if we have meaningful data)
    const totalTimeMs = Date.now() - this.state.pageEntryTime

    // Skip spurious events caused by browser visibility quirks during page load.
    // These occur when a hidden→visible transition happens almost immediately after
    // SDK initialization, resulting in activeTimeMs ≈ 1ms and totalTimeMs ≈ 5ms.
    // We only skip if BOTH values are below the threshold - legitimate events will
    // have at least one meaningful value (user was on page for some duration).
    const isSpuriousEvent =
      this.state.activeTimeMs < MIN_SPURIOUS_THRESHOLD && totalTimeMs < MIN_SPURIOUS_THRESHOLD

    // Skip events if user hasn't been on the page long enough.
    // This prevents spurious engagement events when visibility toggles occur
    // shortly after SPA navigation (e.g., during Framer page transitions).
    // Without this check, navigating then quickly toggling visibility would
    // incorrectly emit engagement for the new page immediately.
    const isTooSoonAfterNavigation = totalTimeMs < MIN_PAGE_TIME_FOR_ENGAGEMENT

    if (!isSpuriousEvent && !isTooSoonAfterNavigation) {
      const event = buildEngagementEvent({
        url: this.state.currentUrl,
        referrer: document.referrer,
        activeTimeMs: this.state.activeTimeMs,
        totalTimeMs,
        sessionId: this.state.sessionId,
      })
      this.options.onEngagement(event)
    }

    // 5. Reset state for next engagement period (preserves sessionId and hasEmittedEngagement)
    this.resetState()
  }

  /**
   * Handle SPA navigation.
   * Called by Tracker when a new pageview is detected.
   *
   * This method:
   * 1. Emits engagement for the OLD page (using stored state)
   * 2. Updates state for the NEW page
   */
  onNavigation(newUrl: string): void {
    // Emit engagement for OLD page (uses state.currentUrl, not window.location)
    this.emitEngagement()

    // Update state for NEW page
    this.state.currentUrl = newUrl
    this.state.currentPath = this.extractPath(newUrl)
    this.state.pageEntryTime = Date.now()
    this.state.activeTimeMs = 0
    this.state.lastActiveTime = Date.now()
    this.state.isUserActive = true
    // Reset the engagement flag for the new page session
    this.state.hasEmittedEngagement = false

    // Reset idle timer
    this.resetIdleTimer()
  }

  /**
   * Stop session tracking and clean up.
   */
  stop(): void {
    // Remove event listeners
    this.removeEventListeners()

    // Clear intervals and timeouts
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval)
      this.timeUpdateInterval = null
    }

    if (this.state.idleTimeoutId) {
      clearTimeout(this.state.idleTimeoutId)
      this.state.idleTimeoutId = null
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private createInitialState(): SessionState {
    const now = Date.now()
    return {
      currentUrl: typeof window !== "undefined" ? window.location.href : "",
      currentPath: typeof window !== "undefined" ? window.location.pathname : "/",
      pageEntryTime: now,
      lastActiveTime: now,
      activeTimeMs: 0,
      isPageVisible:
        typeof document !== "undefined" ? document.visibilityState === "visible" : true,
      isUserActive: true, // Assume active on page load
      idleTimeoutId: null,
      sessionId: this.getOrCreateSessionId(),
      hasEmittedEngagement: false,
    }
  }

  private resetState(): void {
    const now = Date.now()
    this.state.pageEntryTime = now
    this.state.lastActiveTime = now
    this.state.activeTimeMs = 0
    this.state.isUserActive = true
    // Note: hasEmittedEngagement is NOT reset here - it's only reset in onNavigation
    // when a new page session begins. This prevents duplicate events on the same page.
    // Note: sessionId is preserved across page navigations within the same session

    // Reset idle timer
    this.resetIdleTimer()
  }

  /**
   * Get existing session ID from storage or create a new one.
   * Session ID is reset if:
   * - No existing session ID in storage
   * - Last activity was more than 30 minutes ago
   */
  private getOrCreateSessionId(): string {
    if (typeof sessionStorage === "undefined") {
      return this.generateSessionId()
    }

    try {
      const existingSessionId = sessionStorage.getItem(SESSION_ID_KEY)
      const lastActivityStr = sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY)
      const lastActivity = lastActivityStr ? Number.parseInt(lastActivityStr, 10) : 0
      const now = Date.now()

      // Check if session has expired (30 minutes of inactivity)
      if (existingSessionId && lastActivity && now - lastActivity < SESSION_TIMEOUT) {
        // Session is still valid, update last activity
        this.updateSessionActivity()
        return existingSessionId
      }

      // Create new session
      const newSessionId = this.generateSessionId()
      sessionStorage.setItem(SESSION_ID_KEY, newSessionId)
      sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now.toString())
      return newSessionId
    } catch {
      // sessionStorage might throw in private browsing mode
      return this.generateSessionId()
    }
  }

  /**
   * Generate a new session ID (UUID v4).
   */
  private generateSessionId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID()
    }

    // Fallback for older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Update the session's last activity timestamp.
   */
  private updateSessionActivity(): void {
    if (typeof sessionStorage === "undefined") return

    try {
      sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, Date.now().toString())
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Check if the current session has expired and create a new one if needed.
   * Called when user returns to the page after being away.
   */
  private checkSessionExpiry(): void {
    if (typeof sessionStorage === "undefined") return

    try {
      const lastActivityStr = sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY)
      const lastActivity = lastActivityStr ? Number.parseInt(lastActivityStr, 10) : 0
      const now = Date.now()

      if (now - lastActivity >= SESSION_TIMEOUT) {
        // Session expired, create new one
        const newSessionId = this.generateSessionId()
        sessionStorage.setItem(SESSION_ID_KEY, newSessionId)
        this.state.sessionId = newSessionId
      }

      // Update last activity
      sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now.toString())
    } catch {
      // Ignore storage errors
    }
  }

  private setupEventListeners(): void {
    if (typeof window === "undefined" || typeof document === "undefined") return

    // Activity events - explicit user interactions only
    // Do NOT use media events (timeupdate, play, etc.) to avoid video loop false positives
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"]
    for (const event of activityEvents) {
      document.addEventListener(event, this.boundHandleActivity, { passive: true })
    }

    // Visibility change - pause/resume time accumulation
    document.addEventListener("visibilitychange", this.boundHandleVisibilityChange)

    // Start idle timer
    this.resetIdleTimer()
  }

  private removeEventListeners(): void {
    if (typeof window === "undefined" || typeof document === "undefined") return

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"]
    for (const event of activityEvents) {
      document.removeEventListener(event, this.boundHandleActivity)
    }

    document.removeEventListener("visibilitychange", this.boundHandleVisibilityChange)
  }

  /**
   * Handle user activity events.
   * Marks user as active and resets idle timer.
   */
  private handleActivity(): void {
    // If user was idle, check if session expired while idle
    if (!this.state.isUserActive) {
      this.checkSessionExpiry()
      this.state.lastActiveTime = Date.now()
    }

    this.state.isUserActive = true
    this.resetIdleTimer()

    // Update session activity timestamp (throttled - every activity event)
    this.updateSessionActivity()
  }

  /**
   * Handle visibility change events.
   * Pauses time accumulation when tab is hidden.
   */
  private handleVisibilityChange(): void {
    const wasVisible = this.state.isPageVisible
    const isNowVisible = document.visibilityState === "visible"

    if (wasVisible && !isNowVisible) {
      // Tab is being hidden - capture any pending active time BEFORE updating state
      // (updateActiveTime checks isPageVisible, so we must call it first)
      this.updateActiveTime()
    }

    // Update state after capturing time
    this.state.isPageVisible = isNowVisible

    if (!wasVisible && isNowVisible) {
      // Tab is becoming visible - check if session expired while away
      this.checkSessionExpiry()
      // Reset last active time
      this.state.lastActiveTime = Date.now()
      // Reset engagement flag to allow new engagement event on next exit
      this.state.hasEmittedEngagement = false
    }
  }

  /**
   * Reset the idle timer.
   * Called on activity and initialization.
   */
  private resetIdleTimer(): void {
    if (this.state.idleTimeoutId) {
      clearTimeout(this.state.idleTimeoutId)
    }

    this.state.idleTimeoutId = setTimeout(() => {
      // Finalize active time before marking as idle
      this.updateActiveTime()
      this.state.isUserActive = false
    }, this.idleTimeout)
  }

  /**
   * Start the interval for updating active time.
   */
  private startTimeUpdateInterval(): void {
    if (this.timeUpdateInterval) return

    this.timeUpdateInterval = setInterval(() => {
      this.updateActiveTime()
    }, TIME_UPDATE_INTERVAL)
  }

  /**
   * Update accumulated active time.
   * Only accumulates when page is visible AND user is active.
   */
  private updateActiveTime(): void {
    if (this.state.isPageVisible && this.state.isUserActive) {
      const now = Date.now()
      this.state.activeTimeMs += now - this.state.lastActiveTime
      this.state.lastActiveTime = now
    }
  }

  /**
   * Extract path from URL.
   */
  private extractPath(url: string): string {
    try {
      return new URL(url).pathname
    } catch {
      return "/"
    }
  }
}

// ============================================
// MODULE-LEVEL FUNCTIONS
// ============================================

let sessionTrackerInstance: SessionTracker | null = null

/**
 * Initialize session tracking.
 * @returns The SessionTracker instance
 */
export function initSessionTracking(options: SessionTrackerOptions): SessionTracker {
  if (sessionTrackerInstance) {
    console.warn("[Outlit] Session tracking already initialized")
    return sessionTrackerInstance
  }

  sessionTrackerInstance = new SessionTracker(options)
  return sessionTrackerInstance
}

/**
 * Stop session tracking and clean up.
 */
export function stopSessionTracking(): void {
  if (sessionTrackerInstance) {
    sessionTrackerInstance.stop()
    sessionTrackerInstance = null
  }
}
