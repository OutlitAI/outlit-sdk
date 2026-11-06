/** Formats cents as a dollar string. Returns "--" for null/undefined/non-numeric. */
export function formatCents(value: unknown): string {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "--"
  return `$${(value / 100).toFixed(2)}`
}

/** Stripe keeps these two in hundredths although ISO 4217 gives them no minor unit. */
const STRIPE_HUNDREDTHS_CURRENCIES = new Set(["ISK", "UGX"])

/**
 * Formats an `{ amount, currency, estimated }` ARR value the way the Outlit app does: the amount is
 * in Stripe's units for the currency (the currency's own minor-unit digits, with ISK and UGX in
 * hundredths), shown in whole major units with the currency symbol. An estimate (usage or
 * per-seat) is prefixed with `~`. Returns "--" when unknown.
 */
export function formatArr(value: unknown): string {
  if (typeof value !== "object" || value === null) return "--"
  const { amount, currency, estimated } = value as Record<string, unknown>
  if (typeof amount !== "number" || Number.isNaN(amount) || typeof currency !== "string") {
    return "--"
  }
  const code = currency.trim().toUpperCase() || "USD"
  let shown: string
  try {
    const digits =
      new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
    const major = amount / 10 ** (STRIPE_HUNDREDTHS_CURRENCIES.has(code) ? 2 : digits)
    shown = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(major)
  } catch {
    // An unrecognized currency code: show the provider's raw amount with the code.
    shown = `${amount} ${code}`
  }
  return `${estimated === true ? "~" : ""}${shown}`
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
