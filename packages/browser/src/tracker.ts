import {
  type BrowserIdentifyOptions,
  type BrowserTrackOptions,
  DEFAULT_API_HOST,
  type TrackerConfig,
  type TrackerEvent,
  buildCalendarEvent,
  buildCustomEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildIngestPayload,
  buildPageviewEvent,
} from "@outlit/core"
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

    // Initialize session/engagement tracking if enabled (before pageview tracking)
    if (this.options.trackEngagement !== false) {
      this.initSessionTracking()
    }

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
   */
  identify(options: BrowserIdentifyOptions): void {
    if (!this.isTrackingEnabled) {
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
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
      onEngagement: (event) => {
        this.enqueue(event)
      },
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

    const payload = buildIngestPayload(this.visitorId, "client", events)
    const url = `${this.apiHost}/api/i/v1/${this.publicKey}/events`

    try {
      // Use sendBeacon for better reliability on page unload
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" })
        const sent = navigator.sendBeacon(url, blob)
        if (sent) return
      }

      // Fallback to fetch
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      })
    } catch (error) {
      // Silently fail - we don't want to break the user's site
      console.warn("[Outlit] Failed to send events:", error)
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
