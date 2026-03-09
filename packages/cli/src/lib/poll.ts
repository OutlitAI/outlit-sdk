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
}

/**
 * Polls a function until a predicate is satisfied or the timeout elapses.
 *
 * Returns the final result when the predicate returns true, or null on timeout.
 * Optionally updates a spinner with elapsed time during polling.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  opts: PollOptions = {},
): Promise<T | null> {
  const intervalMs = opts.intervalMs ?? 2_000
  const timeoutMs = opts.timeoutMs ?? 300_000
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn()
      if (predicate(result)) return result
    } catch {
      // Transient error (network hiccup, 503, etc.) — keep polling until timeout
    }

    // Update spinner with elapsed time
    if (opts.spinner && opts.spinnerMessage) {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      opts.spinner.update(`${opts.spinnerMessage} (${elapsed}s)`)
    }

    await sleep(intervalMs)
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
