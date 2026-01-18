import {
  type BillingStatus,
  type CustomerIdentifier,
  DEFAULT_API_HOST,
  type ExplicitJourneyStage,
  type IngestPayload,
  type ServerIdentifyOptions,
  type ServerIdentity,
  type ServerTrackOptions,
  type TrackerEvent,
  buildBillingEvent,
  buildCustomEvent,
  buildIdentifyEvent,
  buildStageEvent,
  validateServerIdentity,
} from "@outlit/core"
import { EventQueue } from "./queue"
import { HttpTransport } from "./transport"

// ============================================
// STAGE OPTIONS
// ============================================

/**
 * Options for stage transition events (activate, engaged, inactive).
 * Server-side stage events require user identification (email or userId).
 */
export interface StageOptions extends ServerIdentity {
  /**
   * Optional properties for context.
   */
  properties?: Record<string, string | number | boolean | null>
}

/**
 * Options for billing status events.
 * Requires at least one customer identifier (customerId, stripeCustomerId, or domain).
 */
export interface BillingOptions extends CustomerIdentifier {
  properties?: Record<string, string | number | boolean | null>
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
 * Unlike the browser SDK, this requires identity (email or userId) for all calls.
 * Anonymous tracking is not supported server-side.
 *
 * @example
 * ```typescript
 * import { Outlit } from '@outlit/node'
 *
 * const outlit = new Outlit({ publicKey: 'pk_xxx' })
 *
 * // Track a custom event
 * outlit.track({
 *   email: 'user@example.com',
 *   eventName: 'subscription_created',
 *   properties: { plan: 'pro' }
 * })
 *
 * // Identify/update user
 * outlit.identify({
 *   email: 'user@example.com',
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
   * Requires either `email` or `userId` to identify the user.
   *
   * @throws Error if neither email nor userId is provided
   */
  track(options: ServerTrackOptions): void {
    this.ensureNotShutdown()
    validateServerIdentity(options.email, options.userId)

    const event = buildCustomEvent({
      url: `server://${options.email ?? options.userId}`,
      timestamp: options.timestamp,
      eventName: options.eventName,
      properties: {
        ...options.properties,
        // Include identity in properties for server-side resolution
        __email: options.email ?? null,
        __userId: options.userId ?? null,
      },
    })

    this.queue.enqueue(event)
  }

  /**
   * Identify or update a user.
   *
   * Requires either `email` or `userId` to identify the user.
   *
   * @throws Error if neither email nor userId is provided
   */
  identify(options: ServerIdentifyOptions): void {
    this.ensureNotShutdown()
    validateServerIdentity(options.email, options.userId)

    const event = buildIdentifyEvent({
      url: `server://${options.email ?? options.userId}`,
      email: options.email,
      userId: options.userId,
      traits: options.traits,
    })

    this.queue.enqueue(event)
  }

  /**
   * User namespace methods for contact journey stages.
   */
  readonly user = {
    identify: (options: ServerIdentifyOptions) => this.identify(options),
    activate: (options: StageOptions) => this.sendStageEvent("activated", options),
    engaged: (options: StageOptions) => this.sendStageEvent("engaged", options),
    inactive: (options: StageOptions) => this.sendStageEvent("inactive", options),
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
  private sendStageEvent(stage: ExplicitJourneyStage, options: StageOptions): void {
    this.ensureNotShutdown()
    validateServerIdentity(options.email, options.userId)

    const event = buildStageEvent({
      url: `server://${options.email ?? options.userId}`,
      stage,
      properties: {
        ...options.properties,
        // Include identity in properties for server-side resolution
        __email: options.email ?? null,
        __userId: options.userId ?? null,
      },
    })

    this.queue.enqueue(event)
  }

  private sendBillingEvent(status: BillingStatus, options: BillingOptions): void {
    this.ensureNotShutdown()

    const event = buildBillingEvent({
      url: `server://${options.domain}`,
      status,
      customerId: options.customerId,
      stripeCustomerId: options.stripeCustomerId,
      domain: options.domain,
      properties: options.properties,
    })

    this.queue.enqueue(event)
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

    // For server events, we don't use visitorId - the API resolves identity
    // directly from the event data (email/userId)
    const payload: IngestPayload = {
      source: "server",
      events,
      // visitorId is intentionally omitted for server events
    }

    await this.transport.send(payload)
  }

  private ensureNotShutdown(): void {
    if (this.isShutdown) {
      throw new Error(
        "[Outlit] Client has been shutdown. Create a new instance to continue tracking.",
      )
    }
  }
}
