/**
 * A fresh retry key for one user action. A write sends it as `idempotencyKey`; Core returns the first
 * result for the same key and input, so repeating the call with the same key never repeats the write.
 * Generate it once per action and reuse it for any resend of that call, never across two actions.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
