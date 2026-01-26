import {
  type BillingStatus,
  type BrowserIdentifyOptions,
  type BrowserTrackOptions,
  type CustomerIdentifier,
  DEFAULT_API_HOST,
  type ExplicitJourneyStage,
  type TrackerConfig,
  type TrackerEvent,
  buildBillingEvent,
  buildCalendarEvent,
  buildCustomEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildIngestPayload,
  buildPageviewEvent,
  buildStageEvent,
} from "@outlit/core"

const MAX_PENDING_STAGE_EVENTS = 10
import { initFormTracking, initPageviewTracking, stopAutocapture } from "./autocapture"
import {
  type CalendarBookingEvent,
  initCalendarTracking,
  stopCalendarTracking,
} from "./embed-integrations"
import { type SessionTracker, initSessionTracking, stopSessionTracking } from "./session-tracker"
import { getOrCreateVisitorId } from "./storage"

// ============================================
// OUTLIT CLIENT
// ============================================

export interface OutlitOptions extends TrackerConfig {
  /**
   * Automatically start tracking on init.
   * Set to false if you need to wait for user consent before tracking.
   * Call enableTracking() to start tracking after consent is obtained.
   * @default true
   */
  autoTrack?: boolean
  trackPageviews?: boolean
  trackForms?: boolean
  formFieldDenylist?: string[]
  flushInterval?: number
  /**
   * Automatically identify users when they submit forms with email fields.
   * Extracts email and name (first/last) from form fields using heuristics.
   * @default true
   */
  autoIdentify?: boolean
  /**
   * Track booking events from calendar embeds (Cal.com, Calendly).
   * When enabled, fires a "calendar_booked" custom event when bookings are detected.
   *
   * NOTE: Due to privacy restrictions in Cal.com and Calendly, their postMessage
   * events do NOT include PII (email, name). Auto-identify is NOT possible with
   * these embeds using client-side tracking alone.
   *
   * For auto-identify with calendar bookings, use server-side webhooks.
   * @default true
   */
  trackCalendarEmbeds?: boolean
  /**
   * Track engagement metrics (active time on page).
   * When enabled, emits "engagement" events on page exit and SPA navigation
   * capturing how long users actively engaged with each page.
   * @default true
   */
  trackEngagement?: boolean
  /**
   * Idle timeout in milliseconds for engagement tracking.
   * After this period of no user interaction, the user is considered idle
   * and active time stops accumulating.
   * @default 30000 (30 seconds)
   */
  idleTimeout?: number
}

export interface UserIdentity {
  email?: string
  userId?: string
  traits?: Record<string, string | number | boolean | null>
}

export interface BillingOptions extends CustomerIdentifier {
  properties?: Record<string, string | number | boolean | null>
}

export class Outlit {
  private publicKey: string
  private apiHost: string
  private visitorId: string | null = null
  private eventQueue: TrackerEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private flushInterval: number
  private isInitialized = false
  private isTrackingEnabled = false
  private options: OutlitOptions
  private hasHandledExit = false
  private sessionTracker: SessionTracker | null = null
  // User identity state for stage events
  private currentUser: UserIdentity | null = null
  private pendingUser: UserIdentity | null = null
  private pendingStageEvents: Array<{
    stage: ExplicitJourneyStage
    properties?: Record<string, string | number | boolean | null>
  }> = []

  constructor(options: OutlitOptions) {
    this.publicKey = options.publicKey
    this.apiHost = options.apiHost ?? DEFAULT_API_HOST
    this.flushInterval = options.flushInterval ?? 5000
    this.options = options

    // Set up exit handlers for reliable flushing
    // Uses multiple events because beforeunload is unreliable on mobile
    if (typeof window !== "undefined") {
      const handleExit = () => {
        if (this.hasHandledExit) return
        this.hasHandledExit = true

        // 1. Emit engagement event for current page (if session tracking enabled)
        this.sessionTracker?.emitEngagement()

        // 2. Flush the queue (now includes engagement event)
        this.flush()
      }

      // visibilitychange is most reliable - fires when tab is hidden
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          handleExit()
        } else {
          // Reset when user returns to allow next exit to flush
          this.hasHandledExit = false
        }
      })

      // pagehide is reliable and bfcache-friendly
      window.addEventListener("pagehide", handleExit)

      // beforeunload as fallback for older browsers
      window.addEventListener("beforeunload", handleExit)
    }

    this.isInitialized = true

    // Start tracking immediately unless autoTrack is explicitly false
    if (options.autoTrack !== false) {
      this.enableTracking()
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Enable tracking. Call this after obtaining user consent.
   * This will:
   * - Generate/retrieve the visitor ID
   * - Start automatic pageview and form tracking (if configured)
   * - Begin sending events to the server
   *
   * If autoTrack is true (default), this is called automatically on init.
   */
  enableTracking(): void {
    if (this.isTrackingEnabled) {
      return // Already enabled
    }

    // Now we can generate/retrieve the visitor ID (sets cookies/localStorage)
    this.visitorId = getOrCreateVisitorId()

    // Start the flush timer
    this.startFlushTimer()

    // Always initialize session tracking for session ID management
    // Engagement events are only emitted when trackEngagement is enabled
    this.initSessionTracking()

    // Initialize autocapture if enabled
    if (this.options.trackPageviews !== false) {
      this.initPageviewTracking()
    }

    if (this.options.trackForms !== false) {
      this.initFormTracking(this.options.formFieldDenylist)
    }

    // Initialize calendar embed tracking if enabled
    if (this.options.trackCalendarEmbeds !== false) {
      this.initCalendarTracking()
    }

    this.isTrackingEnabled = true

    // Apply any pending user identity that was set before tracking was enabled
    if (this.pendingUser) {
      this.applyUser(this.pendingUser)
      this.pendingUser = null
    }
  }

  /**
   * Check if tracking is currently enabled.
   */
  isEnabled(): boolean {
    return this.isTrackingEnabled
  }

  /**
   * Track a custom event.
   */
  track(eventName: string, properties?: BrowserTrackOptions["properties"]): void {
    if (!this.isTrackingEnabled) {
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
    }

    const event = buildCustomEvent({
      url: window.location.href,
      referrer: document.referrer,
      eventName,
      properties,
    })
    this.enqueue(event)
  }

  /**
   * Identify the current visitor.
   * Links the anonymous visitor to a known user.
   *
   * When email or userId is provided, also sets the current user identity
   * for stage events (activate, engaged, inactive).
   */
  identify(options: BrowserIdentifyOptions): void {
    if (!this.isTrackingEnabled) {
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
    }

    // Update currentUser if email or userId is provided
    // This enables stage events after identify() is called
    if (options.email || options.userId) {
      const hadNoUser = !this.currentUser
      this.currentUser = {
        email: options.email,
        userId: options.userId,
      }
      if (hadNoUser) {
        this.flushPendingStageEvents()
      }
    }

    const event = buildIdentifyEvent({
      url: window.location.href,
      referrer: document.referrer,
      email: options.email,
      userId: options.userId,
      traits: options.traits,
    })
    this.enqueue(event)
  }

  /**
   * Set the current user identity.
   * This is useful for SPA applications where you know the user's identity
   * after authentication. Calls identify() under the hood.
   *
   * If called before tracking is enabled, the identity is stored as pending
   * and applied automatically when enableTracking() is called.
   *
   * Note: Both setUser() and identify() enable stage events. The difference is
   * setUser() can be called before tracking is enabled (identity is queued),
   * while identify() requires tracking to be enabled first.
   */
  setUser(identity: UserIdentity): void {
    if (!identity.email && !identity.userId) {
      console.warn("[Outlit] setUser requires at least email or userId")
      return
    }

    if (!this.isTrackingEnabled) {
      this.pendingUser = identity
      return
    }

    this.applyUser(identity)
  }

  /**
   * Clear the current user identity.
   * Call this when the user logs out.
   */
  clearUser(): void {
    this.currentUser = null
    this.pendingUser = null
    this.pendingStageEvents = []
  }

  /**
   * Apply user identity and send identify event.
   */
  private applyUser(identity: UserIdentity): void {
    this.currentUser = identity
    this.identify({ email: identity.email, userId: identity.userId, traits: identity.traits })
    this.flushPendingStageEvents()
  }

  /**
   * Flush any pending stage events that were queued before user identity was set.
   */
  private flushPendingStageEvents(): void {
    if (this.pendingStageEvents.length === 0) return

    const events = [...this.pendingStageEvents]
    this.pendingStageEvents = []

    for (const { stage, properties } of events) {
      const event = buildStageEvent({
        url: window.location.href,
        referrer: document.referrer,
        stage,
        properties,
      })
      this.enqueue(event)
    }
  }

  /**
   * User namespace methods for contact journey stages.
   */
  readonly user = {
    identify: (options: BrowserIdentifyOptions) => this.identify(options),
    activate: (properties?: Record<string, string | number | boolean | null>) =>
      this.sendStageEvent("activated", properties),
    engaged: (properties?: Record<string, string | number | boolean | null>) =>
      this.sendStageEvent("engaged", properties),
    inactive: (properties?: Record<string, string | number | boolean | null>) =>
      this.sendStageEvent("inactive", properties),
  }

  /**
   * Customer namespace methods for billing status.
   */
  readonly customer = {
    trialing: (options: BillingOptions) => this.sendBillingEvent("trialing", options),
    paid: (options: BillingOptions) => this.sendBillingEvent("paid", options),
    churned: (options: BillingOptions) => this.sendBillingEvent("churned", options),
  }

  /**
   * Internal method to send a stage event.
   */
  private sendStageEvent(
    stage: ExplicitJourneyStage,
    properties?: Record<string, string | number | boolean | null>,
  ): void {
    if (!this.isTrackingEnabled) {
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
    }

    if (!this.currentUser) {
      if (this.pendingStageEvents.length >= MAX_PENDING_STAGE_EVENTS) {
        console.warn(
          `[Outlit] Pending stage event queue full (${MAX_PENDING_STAGE_EVENTS}). Call setUser() or identify() to flush queued events.`,
        )
        return
      }
      this.pendingStageEvents.push({ stage, properties })
      return
    }

    const event = buildStageEvent({
      url: window.location.href,
      referrer: document.referrer,
      stage,
      properties,
    })
    this.enqueue(event)
  }

  private sendBillingEvent(status: BillingStatus, options: BillingOptions): void {
    if (!this.isTrackingEnabled) {
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
    }

    const event = buildBillingEvent({
      url: window.location.href,
      referrer: document.referrer,
      status,
      customerId: options.customerId,
      stripeCustomerId: options.stripeCustomerId,
      domain: options.domain,
      properties: options.properties,
    })
    this.enqueue(event)
  }

  /**
   * Get the current visitor ID.
   * Returns null if tracking is not enabled.
   */
  getVisitorId(): string | null {
    return this.visitorId
  }

  /**
   * Manually flush the event queue.
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const events = [...this.eventQueue]
    this.eventQueue = []

    await this.sendEvents(events)
  }

  /**
   * Shutdown the client.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    stopAutocapture()
    stopCalendarTracking()
    stopSessionTracking()
    this.sessionTracker = null
    await this.flush()
  }

  // ============================================
  // INTERNAL METHODS
  // ============================================

  private initSessionTracking(): void {
    this.sessionTracker = initSessionTracking({
      // Only emit engagement events when trackEngagement is enabled (default: true)
      onEngagement:
        this.options.trackEngagement !== false ? (event) => this.enqueue(event) : () => {},
      idleTimeout: this.options.idleTimeout,
    })
  }

  private initPageviewTracking(): void {
    initPageviewTracking((url, referrer, title) => {
      // Notify session tracker FIRST (emits engagement for OLD page using stored state)
      // This must happen before enqueueing the new pageview
      this.sessionTracker?.onNavigation(url)

      // Then enqueue pageview for NEW page
      const event = buildPageviewEvent({ url, referrer, title })
      this.enqueue(event)
    })
  }

  private initFormTracking(denylist?: string[]): void {
    // Create identity callback if autoIdentify is enabled (default: true)
    const identityCallback =
      this.options.autoIdentify !== false
        ? (identity: { email: string; name?: string; firstName?: string; lastName?: string }) => {
            // Build traits from extracted name fields
            const traits: Record<string, string> = {}
            if (identity.name) traits.name = identity.name
            if (identity.firstName) traits.firstName = identity.firstName
            if (identity.lastName) traits.lastName = identity.lastName

            this.identify({
              email: identity.email,
              traits: Object.keys(traits).length > 0 ? traits : undefined,
            })
          }
        : undefined

    initFormTracking(
      (url, formId, fields) => {
        const event = buildFormEvent({
          url,
          referrer: document.referrer,
          formId,
          formFields: fields,
        })
        this.enqueue(event)
      },
      denylist,
      identityCallback,
    )
  }

  private initCalendarTracking(): void {
    initCalendarTracking({
      onCalendarBooked: (bookingEvent: CalendarBookingEvent) => {
        // Track the calendar booking as a first-class calendar event
        // Note: Email is NOT available from Cal.com/Calendly client-side events
        // Use server-side webhooks for identify()
        const event = buildCalendarEvent({
          url: window.location.href,
          referrer: document.referrer,
          provider: bookingEvent.provider,
          eventType: bookingEvent.eventType,
          startTime: bookingEvent.startTime,
          endTime: bookingEvent.endTime,
          duration: bookingEvent.duration,
          isRecurring: bookingEvent.isRecurring,
          inviteeEmail: bookingEvent.inviteeEmail,
          inviteeName: bookingEvent.inviteeName,
        })
        this.enqueue(event)
      },
    })
  }

  private enqueue(event: TrackerEvent): void {
    this.eventQueue.push(event)

    // Flush immediately if queue is getting large
    if (this.eventQueue.length >= 10) {
      this.flush()
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  private async sendEvents(events: TrackerEvent[]): Promise<void> {
    if (events.length === 0) return
    if (!this.visitorId) return // Can't send without a visitor ID

    // Include current user identity in payload for direct resolution
    // This allows the server to resolve identity immediately for SPA apps
    // instead of waiting for the anonymous visitor flow
    const userIdentity = this.currentUser ?? undefined
    // Include session ID for grouping all events in this batch
    const sessionId = this.sessionTracker?.getSessionId()
    const payload = buildIngestPayload(this.visitorId, "client", events, userIdentity, sessionId)
    const url = `${this.apiHost}/api/i/v1/${this.publicKey}/events`

    try {
      // Use sendBeacon for better reliability on page unload
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" })
        const sent = navigator.sendBeacon(url, blob)
        if (sent) return
        // sendBeacon failed (quota exceeded, etc.) - fall through to fetch
        console.warn(
          `[Outlit] sendBeacon failed for ${events.length} events, falling back to fetch`,
        )
      }

      // Fallback to fetch
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      })

      if (!response.ok) {
        console.warn(
          `[Outlit] Server returned ${response.status} when sending ${events.length} events`,
        )
      }
    } catch (error) {
      // Log with context, but don't break the user's site
      console.warn(`[Outlit] Failed to send ${events.length} events:`, error)
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: Outlit | null = null

/**
 * Initialize the Outlit client.
 * Should be called once at app startup.
 */
export function init(options: OutlitOptions): Outlit {
  if (instance) {
    console.warn("[Outlit] Already initialized")
    return instance
  }

  instance = new Outlit(options)
  return instance
}

/**
 * Get the Outlit instance.
 * Throws if not initialized.
 */
export function getInstance(): Outlit {
  if (!instance) {
    throw new Error("[Outlit] Not initialized. Call init() first.")
  }
  return instance
}

/**
 * Track a custom event.
 * Convenience method that uses the singleton instance.
 */
export function track(eventName: string, properties?: BrowserTrackOptions["properties"]): void {
  getInstance().track(eventName, properties)
}

/**
 * Identify the current visitor.
 * Convenience method that uses the singleton instance.
 */
export function identify(options: BrowserIdentifyOptions): void {
  getInstance().identify(options)
}

/**
 * Enable tracking after consent is obtained.
 * Call this in your consent management tool's callback.
 * Convenience method that uses the singleton instance.
 */
export function enableTracking(): void {
  getInstance().enableTracking()
}

/**
 * Check if tracking is currently enabled.
 * Convenience method that uses the singleton instance.
 */
export function isTrackingEnabled(): boolean {
  return getInstance().isEnabled()
}

/**
 * Set the current user identity.
 * Convenience method that uses the singleton instance.
 */
export function setUser(identity: UserIdentity): void {
  getInstance().setUser(identity)
}

/**
 * Clear the current user identity (on logout).
 * Convenience method that uses the singleton instance.
 */
export function clearUser(): void {
  getInstance().clearUser()
}

/**
 * Access user and customer namespaces.
 * Convenience method that uses the singleton instance.
 */
export function user(): Outlit["user"] {
  return getInstance().user
}

export function customer(): Outlit["customer"] {
  return getInstance().customer
}
