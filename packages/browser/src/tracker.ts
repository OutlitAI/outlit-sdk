import {
  type BrowserIdentifyOptions,
  type BrowserTrackOptions,
  DEFAULT_API_HOST,
  type TrackerConfig,
  type TrackerEvent,
  buildCustomEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildIngestPayload,
  buildPageviewEvent,
} from "@outlit/core"
import { initFormTracking, initPageviewTracking, stopAutocapture } from "./autocapture"
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

  constructor(options: OutlitOptions) {
    this.publicKey = options.publicKey
    this.apiHost = options.apiHost ?? DEFAULT_API_HOST
    this.flushInterval = options.flushInterval ?? 5000
    this.options = options

    // Set up beforeunload handler
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flush()
      })
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

    // Initialize autocapture if enabled
    if (this.options.trackPageviews !== false) {
      this.initPageviewTracking()
    }

    if (this.options.trackForms !== false) {
      this.initFormTracking(this.options.formFieldDenylist)
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
    await this.flush()
  }

  // ============================================
  // INTERNAL METHODS
  // ============================================

  private initPageviewTracking(): void {
    initPageviewTracking((url, referrer, title) => {
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
