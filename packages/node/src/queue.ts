import type { TrackerEvent } from "@outlit/core"

// ============================================
// EVENT QUEUE
// ============================================

function isNonRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if (!("retryable" in error)) return false

  return (error as { retryable?: unknown }).retryable === false
}

export interface QueueOptions {
  maxSize?: number
  onFlush: (events: TrackerEvent[]) => Promise<void>
}

export class EventQueue {
  private queue: TrackerEvent[] = []
  private maxSize: number
  private onFlush: (events: TrackerEvent[]) => Promise<void>
  private inFlight: Promise<void> | null = null

  constructor(options: QueueOptions) {
    this.maxSize = options.maxSize ?? 100
    this.onFlush = options.onFlush
  }

  /**
   * Add an event to the queue.
   * Triggers flush if queue reaches max size.
   */
  async enqueue(event: TrackerEvent): Promise<void> {
    this.queue.push(event)

    if (this.queue.length >= this.maxSize) {
      await this.flush()
    }
  }

  /**
   * Flush all events in the queue.
   *
   * Resolves only after the events queued before the call were sent. A flush already in flight
   * may hold some of them, or leave newer ones queued, so wait for it first, then send what
   * remains. Another caller's failure is theirs to report; this call sends once.
   */
  async flush(): Promise<void> {
    while (this.inFlight) {
      await this.inFlight.catch(() => {})
    }
    if (this.queue.length === 0) return

    const events = [...this.queue]
    this.queue = []
    const sending = this.send(events)
    this.inFlight = sending

    try {
      await sending
    } finally {
      if (this.inFlight === sending) this.inFlight = null
    }
  }

  private async send(events: TrackerEvent[]): Promise<void> {
    try {
      await this.onFlush(events)
    } catch (error) {
      // Re-add events for retryable failures only.
      // Non-retryable failures (e.g. invalid config 4xx) are dropped to avoid infinite retry loops.
      if (!isNonRetryableError(error)) {
        this.queue = [...events, ...this.queue]
      }
      throw error
    }
  }

  /**
   * Get the number of events in the queue.
   */
  get size(): number {
    return this.queue.length
  }

  /**
   * Check if the queue is currently flushing.
   */
  get flushing(): boolean {
    return this.inFlight !== null
  }
}
