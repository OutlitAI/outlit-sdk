/** Formats cents as a dollar string. Returns "--" for null/undefined/non-numeric. */
export function formatCents(value: unknown): string {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "--"
  return `$${(value / 100).toFixed(2)}`
}

/**
 * Formats an ARR measure (`{ value: Money, estimated }`) with the Money's own `formatted` text. An
 * estimate (usage or per-seat) is prefixed with `~`. Returns "--" when unknown.
 */
export function formatArr(value: unknown): string {
  if (typeof value !== "object" || value === null) return "--"
  const { value: money, estimated } = value as { value?: unknown; estimated?: unknown }
  if (typeof money !== "object" || money === null) return "--"
  const { formatted } = money as { formatted?: unknown }
  if (typeof formatted !== "string" || formatted === "") return "--"
  return `${estimated === true ? "~" : ""}${formatted}`
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

/** Capitalizes the first letter of a string. Returns "--" for null/undefined. */
export function capitalize(value: unknown): string {
  if (value == null || typeof value !== "string") return "--"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Formats a number with locale separators. Returns "--" for null/undefined/non-numeric. */
export function formatNumber(value: unknown): string {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "--"
  return value.toLocaleString("en-US")
}

/** A credit pool forecast: `runs out 2026-12-01 (1,200 left of 5,000)`. Returns "--" when there is none. */
export function formatCredits(value: unknown): string {
  if (typeof value !== "object" || value === null) return "--"
  const { runsOutAt, balance } = value as {
    runsOutAt?: unknown
    balance?: { remaining?: unknown; granted?: unknown }
  }
  if (typeof runsOutAt !== "string") return "--"
  const date = runsOutAt.slice(0, 10)
  const remaining = balance?.remaining
  if (typeof remaining !== "number") return `runs out ${date}`
  const granted = balance?.granted
  return typeof granted === "number"
    ? `runs out ${date} (${formatNumber(remaining)} left of ${formatNumber(granted)})`
    : `runs out ${date} (${formatNumber(remaining)} left)`
}

/** The usage a list is ranked by: `1,204 (3 accounts)`. Returns "--" when the row has none. */
export function formatMeter(value: unknown): string {
  if (typeof value !== "object" || value === null) return "--"
  const { reported, accounts } = value as { reported?: unknown; accounts?: unknown }
  if (typeof reported !== "number") return "--"
  return typeof accounts === "number" && accounts > 1
    ? `${formatNumber(reported)} (${accounts} accounts)`
    : formatNumber(reported)
}
