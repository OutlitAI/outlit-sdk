import {
  type BootstrapResponse,
  type BrowserIdentifyOptions,
  type BrowserTrackOptions,
  buildBootstrapUrl,
  buildCalendarEvent,
  buildCustomEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildIngestPayload,
  buildIngestUrl,
  buildPageviewEvent,
  DEFAULT_API_HOST,
  type PayloadCustomerIdentity,
  type PayloadUserIdentity,
  type TrackerConfig,
  type TrackerEvent,
} from "@outlit/core"

import { initFormTracking, initPageviewTracking, stopAutocapture } from "./autocapture"
import {
  type CalendarBookingEvent,
  initCalendarTracking,
  stopCalendarTracking,
} from "./embed-integrations"
import { initSessionTracking, type SessionTracker, stopSessionTracking } from "./session-tracker"
import { getConsentState, getOrCreateVisitorId, setConsentState } from "./storage"

// ============================================
// OUTLIT CLIENT
// ============================================

const AUTO_MODE_TIMEOUT_MS = 3000
const MAX_PENDING_CALLS = 100

/**
 * Call-time context captured for buffered calls so a replayed event keeps the
 * URL, referrer, and timestamp it was made with.
 */
interface EventContext {
  url: string
  referrer: string
  timestamp: number
}

/**
 * Accept the bootstrap verdict only for a well-formed "consent not required"
 * response — anything else (missing or mistyped fields, non-objects, null)
 * fails closed.
 */
function isConsentNotRequiredVerdict(body: unknown): boolean {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false
  const { country, consentRequired } = body as BootstrapResponse
  return consentRequired === false && (country === null || typeof country === "string")
}

/**
 * A call buffered while the auto-mode region check is pending. Identity
 * transitions (setUser/clearUser/identify) are tracked separately from plain
 * events so a full buffer evicts an old event before an old identity — an
 * evicted identity change would resurrect or lose the caller's intent.
 */
interface PendingCall {
  run: () => void
  identityTransition: boolean
  /**
   * The pendingUser this call implies if consent ends up required: the
   * identity for setUser, null for clearUser, absent for track/identify
   * (identify never seeds pendingUser — same as autoTrack: false).
   */
  pendingUser?: UserIdentity | null
}

/**
 * Shallow-copy identity options so later mutations by the caller can't leak
 * into a buffered call.
 */
function snapshotIdentity(options: BrowserIdentifyOptions): BrowserIdentifyOptions {
  return {
    ...options,
    traits: options.traits ? { ...options.traits } : undefined,
    customerTraits: options.customerTraits ? { ...options.customerTraits } : undefined,
  }
}

export interface OutlitOptions extends TrackerConfig {
  /**
   * Automatically start tracking on init.
   * - `true`: enable immediately on init.
   * - `false`: stay off until enableTracking() is called (e.g. by a consent tool).
   * - `"auto"` (default): ask the Outlit edge endpoint whether the visitor's
   *   region requires opt-in consent. Tracking enables automatically where it
   *   is not required and stays off where it is (EEA, UK, Switzerland, or an
   *   unknown region) or when the check fails. Nothing is written to storage
   *   until tracking is enabled.
   *
   * Persisted consent decisions take precedence in every mode.
   * @default "auto"
   */
  autoTrack?: boolean | "auto"
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

export type UserIdentity = BrowserIdentifyOptions

export interface UserMethods {
  identify: (options: BrowserIdentifyOptions) => void
}

export class Outlit {
  private publicKey: string
  private apiHost: string
  private visitorId: string | null = null
  private eventQueue: TrackerEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private flushInterval: number
  private isTrackingEnabled = false
  private options: OutlitOptions
  private hasHandledExit = false
  private sessionTracker: SessionTracker | null = null
  private currentUser: UserIdentity | null = null
  private pendingUser: UserIdentity | null = null
  private exitCleanups: Array<() => void> = []
  private autoModePending = false
  private bootstrapController: AbortController | null = null
  private pendingCalls: PendingCall[] = []
  private trackingStateListeners = new Set<(enabled: boolean) => void>()

  constructor(options: OutlitOptions) {
    this.publicKey = options.publicKey
    this.apiHost = options.apiHost ?? DEFAULT_API_HOST
    this.flushInterval = options.flushInterval ?? 5000
    this.options = options

    // Warn in dev if multiple instances are created with the same key
    const isDev =
      typeof window !== "undefined" &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    if (isDev) {
      const key = `__outlit_${options.publicKey}`
      if ((window as unknown as Record<string, unknown>)[key]) {
        console.warn(
          "[Outlit] Multiple instances created with the same key. " +
            "If using HMR, this is expected. Otherwise, use init() for singleton behavior " +
            "or call shutdown() on the previous instance.",
        )
      }
      ;(window as unknown as Record<string, unknown>)[key] = true
    }

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
      const visibilityHandler = () => {
        if (document.visibilityState === "hidden") {
          handleExit()
        } else {
          // Reset when user returns to allow next exit to flush
          this.hasHandledExit = false
        }
      }

      document.addEventListener("visibilitychange", visibilityHandler)
      window.addEventListener("pagehide", handleExit)
      window.addEventListener("beforeunload", handleExit)

      this.exitCleanups = [
        () => document.removeEventListener("visibilitychange", visibilityHandler),
        () => window.removeEventListener("pagehide", handleExit),
        () => window.removeEventListener("beforeunload", handleExit),
      ]
    }

    // Persisted explicit decisions win in every mode:
    // - "opted-out" never enables and never fetches the bootstrap endpoint
    // - "opted-in" enables immediately
    // - "legacy-opted-in" (written by older SDK versions on auto-enable) counts
    //   as consent for autoTrack true/false, but not for "auto"
    const autoTrack = options.autoTrack ?? "auto"
    const consent = getConsentState()
    if (consent === "opted-out") {
      // Stay disabled — no bootstrap fetch
    } else if (
      consent === "opted-in" ||
      (consent === "legacy-opted-in" && autoTrack !== "auto") ||
      autoTrack === true
    ) {
      this.enableTrackingInternal(false)
    } else if (autoTrack === "auto") {
      this.startAutoMode()
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
   * - Persist the explicit opt-in decision for future sessions
   *
   * This is the explicit-consent path: it also cancels any pending auto-mode
   * region check and replays calls buffered while it was pending.
   */
  enableTracking(): void {
    this.enableTrackingInternal(true)
  }

  /**
   * Enable tracking without persisting a consent decision.
   * Used for automatic enables (autoTrack: true, persisted consent, or an
   * auto-mode "consent not required" verdict) — only an explicit public
   * enableTracking() call records opt-in.
   */
  private enableTrackingInternal(persistConsent: boolean): void {
    this.cancelAutoMode()

    if (persistConsent) {
      // Persist the explicit opt-in decision — even when tracking is already
      // enabled (e.g. by an earlier automatic enable), the explicit call
      // records consent
      setConsentState(true)
    }

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

    // Replay calls buffered while the auto-mode decision was pending — in
    // call order, each with the context it was made with
    const pending = this.pendingCalls
    this.pendingCalls = []
    for (const call of pending) {
      call.run()
    }

    // Apply an identity that was set while tracking was off without going
    // through the buffer (autoTrack: false, or the latest setUser kept after
    // a consent-required verdict). Buffered calls never write pendingUser,
    // so after a replay this is always null and the fallback is a no-op
    if (this.pendingUser) {
      const user = this.pendingUser
      this.pendingUser = null
      this.applyUser(user, this.snapshotContext())
    }

    // Notify listeners last — state, persistence, and replayed calls must all
    // be in place before observers run, and a throwing listener can't abort
    // the transition
    this.notifyTrackingStateChange()
  }

  /**
   * Disable tracking. Call this when a user revokes consent.
   * This will:
   * - Flush any pending events (captured while user had consent)
   * - Stop the flush timer, pageview tracking, form tracking, and session tracking
   * - Persist the opt-out decision so it's remembered across sessions
   *
   * The SDK instance remains usable — enableTracking() can be called again to re-enable.
   */
  async disableTracking(): Promise<void> {
    // An explicit disable wins over a pending auto-mode decision
    this.cancelAutoMode()
    this.discardPendingCalls()

    // Persist the opt-out first so a page unload during the flush below, or a
    // throwing listener, can't lose the revocation
    setConsentState(false)

    if (!this.isTrackingEnabled) {
      return
    }

    // Flush pending events — they were captured while user had consent
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    stopAutocapture()
    stopCalendarTracking()
    stopSessionTracking()
    await this.flush()
    this.sessionTracker = null

    this.isTrackingEnabled = false
    this.notifyTrackingStateChange()
  }

  /**
   * Check if tracking is currently enabled.
   */
  isEnabled(): boolean {
    return this.isTrackingEnabled
  }

  /**
   * Subscribe to tracking-state changes. The listener is called with the new
   * enabled state whenever tracking is enabled or disabled — including when
   * auto mode resolves asynchronously. Returns an unsubscribe function.
   */
  onTrackingStateChange(listener: (enabled: boolean) => void): () => void {
    this.trackingStateListeners.add(listener)
    return () => {
      this.trackingStateListeners.delete(listener)
    }
  }

  /**
   * Track a custom event.
   */
  track(eventName: string, properties?: BrowserTrackOptions["properties"]): void {
    if (!this.isTrackingEnabled) {
      // Buffer in memory while the auto-mode region check is pending so early
      // calls aren't lost — they're replayed on enable and discarded otherwise
      if (this.autoModePending) {
        const ctx = this.snapshotContext()
        const snapshot = properties ? { ...properties } : undefined
        this.bufferPendingCall({
          run: () => this.recordTrack(eventName, snapshot, ctx),
          identityTransition: false,
        })
        return
      }
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
    }

    this.recordTrack(eventName, properties, this.snapshotContext())
  }

  private recordTrack(
    eventName: string,
    properties: BrowserTrackOptions["properties"] | undefined,
    ctx: EventContext,
  ): void {
    const event = buildCustomEvent({
      url: ctx.url,
      referrer: ctx.referrer,
      timestamp: ctx.timestamp,
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
      if (this.autoModePending) {
        const ctx = this.snapshotContext()
        const snapshot = snapshotIdentity(options)
        this.bufferPendingCall({
          run: () => this.recordIdentify(snapshot, ctx),
          identityTransition: true,
        })
        return
      }
      console.warn("[Outlit] Tracking not enabled. Call enableTracking() first.")
      return
    }

    this.recordIdentify(options, this.snapshotContext())
  }

  private recordIdentify(options: BrowserIdentifyOptions, ctx: EventContext): void {
    if (!options.email && !options.userId) {
      console.warn("[Outlit] identify requires email or userId")
      return
    }

    const nextUser = {
      email: options.email,
      userId: options.userId,
      customerId: options.customerId,
      customerTraits: options.customerTraits,
      traits: options.traits,
    }

    // sendEvents snapshots currentUser synchronously before its first await. Flush
    // before changing attribution so queued events retain the identity they had
    // when they were recorded.
    if (this.hasAttributionChanged(nextUser)) {
      void this.flush()
    }
    this.currentUser = nextUser

    const event = buildIdentifyEvent({
      url: ctx.url,
      referrer: ctx.referrer,
      timestamp: ctx.timestamp,
      email: options.email,
      userId: options.userId,
      customerId: options.customerId,
      customerTraits: options.customerTraits,
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
   * Unlike identify(), setUser() can be called before tracking is enabled.
   */
  setUser(identity: UserIdentity): void {
    if (!identity.email && !identity.userId) {
      console.warn("[Outlit] setUser requires at least email or userId")
      return
    }

    if (!this.isTrackingEnabled) {
      if (this.autoModePending) {
        // Buffer so it replays in call order alongside track/identify calls;
        // pendingUser picks up this identity only if consent ends up required
        const snapshot = snapshotIdentity(identity)
        const ctx = this.snapshotContext()
        this.bufferPendingCall({
          run: () => this.applyUser(snapshot, ctx),
          identityTransition: true,
          pendingUser: snapshot,
        })
        return
      }
      this.pendingUser = identity
      return
    }

    this.applyUser(identity, this.snapshotContext())
  }

  /**
   * Clear the current user identity.
   * Call this when the user logs out.
   */
  clearUser(): void {
    if (this.autoModePending) {
      // Buffer so the clear replays between the calls it was made between; a
      // consent-required verdict keeps pendingUser: null like autoTrack: false
      this.bufferPendingCall({
        run: () => this.clearUser(),
        identityTransition: true,
        pendingUser: null,
      })
      return
    }
    if (this.currentUser) {
      void this.flush()
    }
    this.currentUser = null
    this.pendingUser = null
  }

  /**
   * Apply user identity and send identify event.
   */
  private applyUser(identity: UserIdentity, ctx: EventContext): void {
    this.recordIdentify(
      {
        email: identity.email,
        userId: identity.userId,
        traits: identity.traits,
        customerId: identity.customerId,
        customerTraits: identity.customerTraits,
      },
      ctx,
    )
  }

  private snapshotContext(): EventContext {
    return {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: Date.now(),
    }
  }

  private hasAttributionChanged(nextUser: UserIdentity): boolean {
    if (!this.currentUser) {
      return false
    }

    const normalizeEmail = (email: string | undefined) => email?.trim().toLowerCase()
    const normalizeId = (id: string | undefined) => id?.trim()

    return (
      normalizeEmail(this.currentUser.email) !== normalizeEmail(nextUser.email) ||
      normalizeId(this.currentUser.userId) !== normalizeId(nextUser.userId) ||
      normalizeId(this.currentUser.customerId) !== normalizeId(nextUser.customerId)
    )
  }

  /** User namespace method for identity. */
  readonly user: UserMethods = {
    identify: (options: BrowserIdentifyOptions) => this.identify(options),
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
    this.cancelAutoMode()
    this.pendingCalls = []
    // Only tear down shared capture when this instance started it — a pending
    // or never-enabled client owns none of it, and stopping it would kill a
    // different enabled client's tracking on the same page
    if (this.isTrackingEnabled) {
      if (this.flushTimer) {
        clearInterval(this.flushTimer)
        this.flushTimer = null
      }
      stopAutocapture()
      stopCalendarTracking()
      stopSessionTracking()
      this.sessionTracker = null
    }
    for (const cleanup of this.exitCleanups) {
      cleanup()
    }
    this.exitCleanups = []
    if (
      typeof window !== "undefined" &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      delete (window as unknown as Record<string, unknown>)[`__outlit_${this.publicKey}`]
    }
    await this.flush()
  }

  // ============================================
  // INTERNAL METHODS
  // ============================================

  /**
   * Auto mode: ask the edge bootstrap endpoint whether the visitor's region
   * requires opt-in consent. Fails closed — tracking only turns on for an
   * explicit `consentRequired: false` response; errors, timeouts, and
   * "required" verdicts leave the SDK behaving like autoTrack: false.
   */
  private startAutoMode(): void {
    // No fetch during SSR or where fetch doesn't exist — stay disabled
    if (typeof window === "undefined" || typeof fetch !== "function") return

    this.autoModePending = true

    const controller = new AbortController()
    this.bootstrapController = controller
    const timeout = setTimeout(() => controller.abort(), AUTO_MODE_TIMEOUT_MS)

    void (async () => {
      try {
        const response = await fetch(buildBootstrapUrl(this.apiHost, this.publicKey), {
          credentials: "omit",
          signal: controller.signal,
        })
        const body: unknown = response.ok ? await response.json() : null
        this.resolveAutoMode(isConsentNotRequiredVerdict(body))
      } catch {
        this.resolveAutoMode(false)
      } finally {
        clearTimeout(timeout)
      }
    })()
  }

  private resolveAutoMode(granted: boolean): void {
    // An explicit enable/disable or shutdown during the pending window wins —
    // a late bootstrap result must never override it
    if (!this.autoModePending) return
    this.autoModePending = false
    this.bootstrapController = null

    // Re-read persisted consent before enabling: another tab or instance may
    // have recorded an explicit opt-out while the check was in flight, and an
    // opt-out always wins over a "not required" verdict
    if (granted && getConsentState() !== "opted-out") {
      this.enableTrackingInternal(false)
    } else {
      // Consent required or check failed — pre-consent calls are never sent
      this.discardPendingCalls()
    }
  }

  private cancelAutoMode(): void {
    if (!this.autoModePending) return
    this.autoModePending = false
    this.bootstrapController?.abort()
    this.bootstrapController = null
  }

  private bufferPendingCall(call: PendingCall): void {
    if (this.pendingCalls.length >= MAX_PENDING_CALLS) {
      // Evict the oldest plain call first — an identity transition is only
      // dropped when nothing else remains
      const evict = this.pendingCalls.findIndex((c) => !c.identityTransition)
      this.pendingCalls.splice(evict === -1 ? 0 : evict, 1)
    }
    this.pendingCalls.push(call)
  }

  /**
   * Drop the buffer on a denied verdict or explicit disable — the latest
   * setUser identity (or clearUser's null) survives as pendingUser, matching
   * autoTrack: false where those calls were never buffered.
   */
  private discardPendingCalls(): void {
    for (const call of this.pendingCalls) {
      if (call.pendingUser !== undefined) {
        this.pendingUser = call.pendingUser
      }
    }
    this.pendingCalls = []
  }

  private notifyTrackingStateChange(): void {
    for (const listener of this.trackingStateListeners) {
      try {
        listener(this.isTrackingEnabled)
      } catch (error) {
        console.warn("[Outlit] tracking-state listener threw:", error)
      }
    }
  }

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

  private getPayloadUserIdentity(): PayloadUserIdentity | undefined {
    if (!this.currentUser) {
      return undefined
    }

    const { email, userId } = this.currentUser

    if (!email && !userId) {
      return undefined
    }

    return {
      ...(email && { email }),
      ...(userId && { userId }),
    }
  }

  private getPayloadCustomerIdentity(): PayloadCustomerIdentity | undefined {
    if (!this.currentUser) {
      return undefined
    }

    const { customerId } = this.currentUser

    if (!customerId) {
      return undefined
    }

    return {
      ...(customerId && { customerId }),
    }
  }

  private async sendEvents(events: TrackerEvent[]): Promise<void> {
    if (events.length === 0) return
    if (!this.visitorId) return // Can't send without a visitor ID

    // Include only attribution identifiers in payload-level user identity.
    // Profile traits travel on identify events, not on subsequent track batches.
    const userIdentity = this.getPayloadUserIdentity()
    const customerIdentity = this.getPayloadCustomerIdentity()
    // Include session ID for grouping all events in this batch
    const sessionId = this.sessionTracker?.getSessionId()
    const payload = buildIngestPayload(
      this.visitorId,
      "client",
      events,
      userIdentity,
      sessionId,
      undefined,
      customerIdentity,
    )
    const url = buildIngestUrl(this.apiHost, this.publicKey)

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
 * Disable tracking and persist the opt-out decision.
 * Convenience method that uses the singleton instance.
 */
export async function disableTracking(): Promise<void> {
  await getInstance().disableTracking()
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
 * Access the user namespace.
 * Convenience method that uses the singleton instance.
 */
export function user(): Outlit["user"] {
  return getInstance().user
}
