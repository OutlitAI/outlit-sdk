/**
 * A fresh retry key for one user action. A write sends it as `requestId`; Core returns the first
 * result for the same key and input, so repeating the call with the same id never repeats the write.
 * Generate it once per action and reuse it for any resend of that call, never across two actions.
 */
export function newRequestId(): string {
  return crypto.randomUUID()
}
