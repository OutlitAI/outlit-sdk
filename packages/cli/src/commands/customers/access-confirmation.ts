import type { PendingConfirmation } from "../../lib/confirm"

type AccessResult = {
  outcome: string
  reason?: string
  preview?: { token: string }
}

/** `set_customer_access` asks to be confirmed (`needs_confirmation`) when the caller could not undo it. */
export function readAccessConfirmation(result: unknown): PendingConfirmation | null {
  const data = result as AccessResult
  if (data.outcome !== "needs_confirmation" || !data.preview) return null
  return {
    token: data.preview.token,
    lines: [data.reason ?? "This change cannot be undone by you."],
  }
}
