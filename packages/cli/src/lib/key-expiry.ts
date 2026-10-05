/** Personal CLI keys expire; the CLI warns this many days ahead. */
export const KEY_EXPIRY_WARNING_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The warning for a key that expires within KEY_EXPIRY_WARNING_DAYS, or null
 * for a key that never expires, expires later, or has already expired (the
 * server refuses those).
 */
export function keyExpiryWarning(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!expiresAt) return null
  const remainingMs = Date.parse(expiresAt) - now.getTime()
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return null
  if (remainingMs > KEY_EXPIRY_WARNING_DAYS * DAY_MS) return null
  const days = Math.max(1, Math.ceil(remainingMs / DAY_MS))
  return `Warning: your Outlit API key expires in ${days} day${days === 1 ? "" : "s"}. Run \`outlit login\` to get a new one.\n`
}

let warned = false

/** Writes the expiry warning to stderr at most once per run. */
export function warnIfKeyExpiresSoon(expiresAt: string | null | undefined): void {
  if (warned) return
  const warning = keyExpiryWarning(expiresAt)
  if (!warning) return
  warned = true
  process.stderr.write(warning)
}
