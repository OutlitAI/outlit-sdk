import { isInteractive, isUnicodeSupported } from "./tty"

export interface Spinner {
  update(message: string): void
  stop(message: string): void
  fail(message: string): void
}

// Braille spinner frames generated at runtime to avoid encoding issues
// when the bundled file is read as Latin-1 instead of UTF-8.
const UNICODE_FRAMES = [0x280b, 0x2819, 0x2839, 0x2838, 0x283c, 0x2834, 0x2826, 0x2827, 0x2807, 0x280f].map(
  (cp) => String.fromCodePoint(cp),
)
const ASCII_FRAMES = ["-", "\\", "|", "/"]

const FRAMES = isUnicodeSupported ? UNICODE_FRAMES : ASCII_FRAMES
const INTERVAL_MS = 80

// Use 0x2713 (✓) to match TICK in config.ts
const SUCCESS_SYMBOL = isUnicodeSupported ? String.fromCodePoint(0x2713) : String.fromCodePoint(0x221a)
const FAIL_SYMBOL = isUnicodeSupported ? String.fromCodePoint(0x2717) : "x"

const HIDE_CURSOR = "\x1B[?25l"
const SHOW_CURSOR = "\x1B[?25h"

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
  let stopped = false

  process.stderr.write(HIDE_CURSOR)

  const removeSignalHandlers = () => {
    process.off("SIGINT", onSigint)
    process.off("SIGTERM", onSigterm)
  }

  const cleanup = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    removeSignalHandlers()
    process.stderr.write(SHOW_CURSOR)
  }

  // Restore cursor if the process is interrupted (130 = SIGINT, 143 = SIGTERM)
  const onSigint = () => {
    cleanup()
    process.exit(130)
  }
  const onSigterm = () => {
    cleanup()
    process.exit(143)
  }
  process.on("SIGINT", onSigint)
  process.on("SIGTERM", onSigterm)

  const timer = setInterval(() => {
    const frame = FRAMES[frameIndex % FRAMES.length]!
    process.stderr.write(`\r\x1B[2K  ${frame} ${text}`)
    frameIndex++
  }, INTERVAL_MS)

  const finish = (symbol: string, color: string, msg: string) => {
    if (stopped) return
    cleanup()
    process.stderr.write(`\r\x1B[2K  ${color}${symbol}\x1b[0m ${msg}\n`)
  }

  return {
    update(msg: string) {
      text = msg
    },
    stop(msg: string) {
      finish(SUCCESS_SYMBOL, "\x1b[32m", msg)
    },
    fail(msg: string) {
      finish(FAIL_SYMBOL, "\x1b[31m", msg)
    },
  }
}
