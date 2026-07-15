import {
  buildCustomEvent,
  buildIdentifyEvent,
  DEFAULT_API_HOST,
  type IngestPayload,
  type ServerIdentifyOptions,
  type ServerTrackOptions,
  type TrackerEvent,
  validateServerIdentity,
} from "@outlit/core"
import { EventQueue } from "./queue"
import { HttpTransport, TransportError } from "./transport"

export interface UserMethods {
  identify: (options: ServerIdentifyOptions) => void
}

// ============================================
// OUTLIT CLIENT
// ============================================

export interface OutlitOptions {
  /**
   * Your Outlit public key.
   */
  publicKey: string

  /**
   * API host URL.
   * @default "https://app.outlit.ai"
   */
  apiHost?: string

  /**
   * How often to flush events (in milliseconds).
   * @default 10000 (10 seconds)
   */
  flushInterval?: number

  /**
   * Maximum number of events to batch before flushing.
   * @default 100
   */
  maxBatchSize?: number

  /**
   * Request timeout in milliseconds.
   * @default 10000 (10 seconds)
   */
  timeout?: number
}

/**
 * Outlit server-side tracking client.
 *
 * Supports tracking with fingerprint (device ID), email, userId, or customer attribution.
 * Use fingerprint for anonymous tracking that can be linked to users later.
 *
 * @example
 * ```typescript
 * import { Outlit } from '@outlit/node'
 *
 * const outlit = new Outlit({ publicKey: 'pk_xxx' })
 *
 * // Track with fingerprint only (anonymous, stored for later backfill)
 * outlit.track({
 *   fingerprint: deviceId,
 *   eventName: 'page_view',
 *   properties: { page: '/pricing' }
 * })
 *
 * // Track with customer attribution only
 * outlit.track({
 *   customerId: 'cust_123',
 *   eventName: 'account_synced'
 * })
 * // `customerId`-only events stay attributable immediately and can later
 * // link to the email-resolved customer when identify() uses the same customerId.
 *
 * // Track with email (resolves immediately)
 * outlit.track({
 *   email: 'user@example.com',
 *   eventName: 'subscription_created',
 *   properties: { plan: 'pro' }
 * })
 *
 * // Identify user and link fingerprint to email
 * outlit.identify({
 *   email: 'user@example.com',
 *   fingerprint: deviceId,  // Links this device to the user
 *   userId: 'usr_123',
 *   traits: { name: 'John Doe' }
 * })
 *
 * // Flush before shutdown (important for serverless)
 * await outlit.flush()
 * ```
 */
export class Outlit {
  private transport: HttpTransport
  private queue: EventQueue
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private flushInterval: number
  private isShutdown = false
  private fatalTransportError: TransportError | null = null

  constructor(options: OutlitOptions) {
    const apiHost = options.apiHost ?? DEFAULT_API_HOST
    this.flushInterval = options.flushInterval ?? 10000

    this.transport = new HttpTransport({
      apiHost,
      publicKey: options.publicKey,
      timeout: options.timeout,
    })

    this.queue = new EventQueue({
      maxSize: options.maxBatchSize ?? 100,
      onFlush: async (events) => {
        await this.sendEvents(events)
      },
    })

    // Start flush timer
    this.startFlushTimer()
  }

  /**
   * Track a custom event.
   *
   * Requires at least one of: `fingerprint`, `email`, `userId`, or `customerId`.
   *
   * - Use `fingerprint` for anonymous tracking (events linked later via identify)
   * - Use `email` or `userId` for user-scoped attribution
   * - Use `customerId` for customer/account/workspace-scoped attribution
   * - If you later call `identify({ email, customerId })`, Outlit can link earlier
   *   `customerId`-only events to the customer resolved from email
   * - `userId` is your system-owned user/contact ID
   * - `customerId` is your system-owned customer/account/workspace ID
   *
   * @throws Error if no identity is provided
   */
  track(options: ServerTrackOptions): void {
    this.ensureNotShutdown()
    validateServerIdentity(options.fingerprint, options.email, options.userId, options.customerId)

    const event = buildCustomEvent({
      url: `server://${
        options.email ?? options.userId ?? options.customerId ?? options.fingerprint
      }`,
      timestamp: options.timestamp,
      eventName: options.eventName,
      email: options.email,
      userId: options.userId,
      fingerprint: options.fingerprint,
      customerId: options.customerId,
      properties: options.properties,
    })

    this.queue.enqueue(event)
  }

  /**
   * Identify or update a user.
   *
   * Requires `email` or `userId` to establish user-scoped identity.
   * Optionally include `fingerprint` and customer attribution fields to link them.
   * `userId` is your system-owned user/contact ID and `customerId` is your system-owned
   * customer/account/workspace ID. When `email` and `customerId` are sent together,
   * Outlit can link that account/workspace to the customer resolved from email.
   *
   * This is how you link anonymous fingerprint-tracked events to a real user:
   * ```typescript
   * outlit.identify({
   *   email: 'user@example.com',
   *   fingerprint: deviceId,  // Links this device to the user
   *   userId: 'usr_123',      // Links this app user ID to the user
   * });
   * ```
   *
   * @throws Error if neither email nor userId is provided
   */
  identify(options: ServerIdentifyOptions): void {
    this.ensureNotShutdown()

    // Identify requires user-scoped identity.
    if (!options.email && !options.userId) {
      throw new Error(
        "identify() requires email or userId to establish user-scoped identity. " +
          "Use customerId as the optional account/workspace identifier for linking attribution.",
      )
    }

    const event = buildIdentifyEvent({
      url: `server://${options.email ?? options.userId}`,
      email: options.email,
      userId: options.userId,
      fingerprint: options.fingerprint,
      traits: options.traits,
      customerId: options.customerId,
      customerTraits: options.customerTraits,
    })

    this.queue.enqueue(event)
  }

  /** User namespace method for identity. */
  readonly user: UserMethods = {
    identify: (options: ServerIdentifyOptions) => this.identify(options),
  }

  /**
   * Flush all pending events immediately.
   *
   * Important: Call this before your serverless function exits!
   */
  async flush(): Promise<void> {
    await this.queue.flush()
  }

  /**
   * Shutdown the client gracefully.
   *
   * Flushes remaining events and stops the flush timer.
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return

    this.isShutdown = true

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    await this.flush()
  }

  /**
   * Get the number of events waiting to be sent.
   */
  get queueSize(): number {
    return this.queue.size
  }

  // ============================================
  // INTERNAL METHODS
  // ============================================

  private startFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        if (this.isNonRetryableTransportError(error)) {
          // Already handled and logged in sendEvents().
          return
        }
        console.error("[Outlit] Flush error:", error)
      })
    }, this.flushInterval)

    // Don't block process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref()
    }
  }

  private async sendEvents(events: TrackerEvent[]): Promise<void> {
    if (events.length === 0) return
    if (this.fatalTransportError) return

    // For server events, we don't use visitorId - the API resolves identity
    // directly from the event data (email/userId)
    const payload: IngestPayload = {
      source: "server",
      events,
      // visitorId is intentionally omitted for server events
    }

    try {
      await this.transport.send(payload)
    } catch (error) {
      if (this.isNonRetryableTransportError(error)) {
        this.handleFatalTransportError(error)
      }
      throw error
    }
  }

  private ensureNotShutdown(): void {
    if (this.isShutdown) {
      throw new Error(
        "[Outlit] Client has been shutdown. Create a new instance to continue tracking.",
      )
    }
  }

  private isNonRetryableTransportError(error: unknown): error is TransportError {
    return error instanceof TransportError && error.retryable === false
  }

  private handleFatalTransportError(error: TransportError): void {
    if (this.fatalTransportError) return

    this.fatalTransportError = error

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    console.error(
      "[Outlit] Non-retryable ingest error. Automatic flush retries disabled until client restart:",
      error,
    )
  }
}
