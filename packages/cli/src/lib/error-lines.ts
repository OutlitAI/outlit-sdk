import type { ToolGatewayErrorEnvelope } from "@outlit/tools"

/**
 * What a gateway error says beside its message, one line each, for a terminal: the fix for each field
 * that failed validation (its path, then the message Core wrote or its code, then the values it
 * accepts), how long to wait on a rate limit, and the permission a key lacks.
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
  if (envelope.missingPermission) lines.push(`Missing permission: ${envelope.missingPermission}`)
  return lines
}
