import { isInteractive } from "./tty"

export interface Spinner {
  update(message: string): void
  stop(message: string): void
  fail(message: string): void
}

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const INTERVAL_MS = 80

/**
 * Creates a braille spinner that writes to stderr.
 *
 * Returns a no-op spinner when non-interactive (piped, CI, JSON mode).
 * Stderr output keeps stdout clean for JSON/piped data.
 */
export function createSpinner(message: string): Spinner {
  if (!isInteractive()) {
    return { update() {}, stop() {}, fail() {} }
  }

  let frameIndex = 0
  let text = message

  const timer = setInterval(() => {
    const frame = FRAMES[frameIndex % FRAMES.length]!
    process.stderr.write(`\r\x1B[2K  ${frame} ${text}`)
    frameIndex++
  }, INTERVAL_MS)

  return {
    update(msg: string) {
      text = msg
    },
    stop(msg: string) {
      clearInterval(timer)
      process.stderr.write(`\r\x1B[2K  \x1b[32m✔\x1b[0m ${msg}\n`)
    },
    fail(msg: string) {
      clearInterval(timer)
      process.stderr.write(`\r\x1B[2K  \x1b[31m✗\x1b[0m ${msg}\n`)
    },
  }
}
