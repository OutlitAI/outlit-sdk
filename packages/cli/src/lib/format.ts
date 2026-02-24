/** Formats cents as a dollar string. Returns "--" for null/undefined/non-numeric. */
export function formatCents(value: unknown): string {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "--"
  return `$${(value / 100).toFixed(2)}`
}

/** Formats an ISO date string as relative time. Returns "--" for null/undefined. */
export function relativeDate(value: unknown): string {
  if (value == null || typeof value !== "string") return "--"
  const ms = Date.now() - new Date(value).getTime()
  if (Number.isNaN(ms)) return "--"
  if (ms < 0) return "just now"
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Truncates a string to maxLen with "...". Returns "--" for null/undefined. */
export function truncate(value: unknown, maxLen: number): string {
  if (value == null) return "--"
  const str = String(value)
  if (str.length <= maxLen) return str
  if (maxLen <= 3) return "...".slice(0, maxLen)
  return `${str.slice(0, maxLen - 3)}...`
}
