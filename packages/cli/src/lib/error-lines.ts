import type { ToolGatewayErrorEnvelope } from "@outlit/tools"

/**
 * What a gateway error says beside its message, one line each, for a terminal: the fix for each field
 * that failed validation (its path, then the message Core wrote or its code, then the values it
 * accepts), how long to wait on a rate limit (`RATE_LIMITED`), when a spent plan allowance resets
 * (not retryable until then), and the permission a key lacks.
 */
export function envelopeLines(envelope: ToolGatewayErrorEnvelope): string[] {
  const lines: string[] = []
  for (const issue of envelope.validationIssues ?? []) {
    const what = issue.message ?? issue.code
    const valid = issue.validValues?.length ? ` (one of: ${issue.validValues.join(", ")})` : ""
    lines.push(`  ${issue.path || "input"}: ${what}${valid}`)
  }
  if (envelope.retryAfterSeconds !== undefined) {
    lines.push(`Retry in ${envelope.retryAfterSeconds}s.`)
  }
  // The plan allowance is spent: retrying before it resets fails again, so say when it does.
  const resetsAt = envelope.resetsAt ?? undefined
  if (resetsAt && envelope.code === "plan_api_limit_exceeded") {
    lines.push(
      `Plan API call limit reached. Resets at ${resetsAt}; retrying before then will fail.`,
    )
  }
  if (envelope.missingPermission) lines.push(`Missing permission: ${envelope.missingPermission}`)
  return lines
}
