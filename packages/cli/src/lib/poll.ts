import type { Spinner } from "./spinner"

export interface PollOptions {
  /** Milliseconds between polls. Default: 2000. */
  intervalMs?: number
  /** Maximum milliseconds before giving up. Default: 300000 (5 minutes). */
  timeoutMs?: number
  /** Optional spinner to update with elapsed time. */
  spinner?: Spinner
  /** Base message for spinner updates. */
  spinnerMessage?: string
  /** Return false to propagate a non-retryable polling error immediately. */
  shouldRetry?: (error: unknown) => boolean
}

/**
 * Polls a function until a predicate is satisfied or the timeout elapses.
 *
 * Returns the final result when the predicate returns true, or null on timeout.
 * Optionally updates a spinner with elapsed time during polling.
 */
export async function pollUntil<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  predicate: (result: T) => boolean,
  opts: PollOptions = {},
): Promise<T | null> {
  const intervalMs = opts.intervalMs ?? 2_000
  const timeoutMs = opts.timeoutMs ?? 300_000
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const remainingMs = timeoutMs - (Date.now() - start)
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), remainingMs)
    try {
      const result = await fn(controller.signal)
      if (predicate(result)) return result
    } catch (error) {
      if (controller.signal.aborted && Date.now() - start >= timeoutMs) return null
      if (opts.shouldRetry?.(error) === false) throw error
      // Transient error (network hiccup, 503, etc.) — keep polling until timeout
    } finally {
      clearTimeout(deadline)
    }

    // Update spinner with elapsed time
    if (opts.spinner && opts.spinnerMessage) {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      opts.spinner.update(`${opts.spinnerMessage} (${elapsed}s)`)
    }

    await sleep(Math.min(intervalMs, Math.max(0, timeoutMs - (Date.now() - start))))
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
