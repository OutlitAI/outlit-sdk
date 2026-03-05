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
  private isFlushing = false

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
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return

    this.isFlushing = true
    const events = [...this.queue]
    this.queue = []

    try {
      await this.onFlush(events)
    } catch (error) {
      // Re-add events for retryable failures only.
      // Non-retryable failures (e.g. invalid config 4xx) are dropped to avoid infinite retry loops.
      if (!isNonRetryableError(error)) {
        this.queue = [...events, ...this.queue]
      }
      throw error
    } finally {
      this.isFlushing = false
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
    return this.isFlushing
  }
}
