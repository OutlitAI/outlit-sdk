import {
  customerSourceTypeAliases,
  customerSourceTypeAliasMap,
  customerSourceTypeInputs,
  customerSourceTypes,
  publicToolContracts,
  publicToolNames,
} from "./generated/contracts.js"

export type JsonSchema = Readonly<Record<string, unknown>>
export type PublicToolName = (typeof publicToolNames)[number]
export type PublicToolContract = (typeof publicToolContracts)[PublicToolName]
export type CustomerSourceType = (typeof customerSourceTypes)[number]
export type CustomerSourceTypeInput = (typeof customerSourceTypeInputs)[number]

const publicToolNameSet = new Set<string>(publicToolNames)
const customerSourceTypeSet = new Set<string>(customerSourceTypes)
const iso8601UtcDateTimeRegex =
  /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$/

export function isPublicToolName(value: string): value is PublicToolName {
  return publicToolNameSet.has(value)
}

export function getPublicToolContract<TName extends PublicToolName>(
  name: TName,
): (typeof publicToolContracts)[TName] {
  return publicToolContracts[name]
}

export function normalizeCustomerSourceType(value: string): CustomerSourceType | null {
  const normalized = value.trim().toUpperCase()
  if (customerSourceTypeSet.has(normalized)) return normalized as CustomerSourceType
  return (
    customerSourceTypeAliasMap[normalized as (typeof customerSourceTypeAliases)[number]] ?? null
  )
}

/**
 * Aliases the source tools (get and list) accept on input only. The timeline labels Stripe billing
 * rows STRIPE_INVOICE, so normalizeCustomerSourceType does not map them. Mirrors Core's
 * customerSourceToolInputAliasMap, which the generated contracts don't carry.
 */
const customerSourceToolInputAliasMap = {
  STRIPE_INVOICE: "INVOICE",
} as const satisfies Record<string, CustomerSourceType>

/** The canonical type a source tool's sourceType input names, including its input-only aliases. */
export function normalizeCustomerSourceToolInput(value: string): CustomerSourceType | null {
  const normalized = normalizeCustomerSourceType(value)
  if (normalized) return normalized
  const key = value.trim().toUpperCase()
  if (!Object.hasOwn(customerSourceToolInputAliasMap, key)) return null
  return customerSourceToolInputAliasMap[key as keyof typeof customerSourceToolInputAliasMap]
}

/** A source type filter value for search and facts: canonical types, plus STRIPE_INVOICE as sent. */
export type CustomerSourceFilterType = CustomerSourceType | "STRIPE_INVOICE"

/**
 * Normalizes a source-type filter for the search and facts list tools. Like Core, those tools take
 * STRIPE_INVOICE as a raw filter value, so it passes through unchanged instead of becoming INVOICE.
 */
export function normalizeCustomerSourceFilterInput(value: string): CustomerSourceFilterType | null {
  if (value.trim().toUpperCase() === "STRIPE_INVOICE") return "STRIPE_INVOICE"
  return normalizeCustomerSourceType(value)
}

export type SearchArgsLike = {
  query?: string
  customer?: string | null
  topK?: number
  after?: string
  before?: string
  sourceTypes?: string[]
}

export type CustomerContextSearchInput = {
  query: string
  customer?: string | null
  topK?: number
  after?: string
  before?: string
  sourceTypes?: CustomerSourceFilterType[]
}

export function resolveCustomerContextSearchInput(
  value: SearchArgsLike,
): { ok: true; request: CustomerContextSearchInput } | { ok: false; message: string } {
  if (!value.query) return { ok: false, message: "A query argument is required" }

  const normalizedQuery = value.query.trim()
  if (normalizedQuery.length < 2) {
    return { ok: false, message: "Query must be at least 2 non-whitespace characters" }
  }

  if (value.after !== undefined && !iso8601UtcDateTimeRegex.test(value.after)) {
    return { ok: false, message: "--after must be a valid ISO 8601 datetime" }
  }
  const afterTime = value.after === undefined ? undefined : new Date(value.after).getTime()
  if (afterTime !== undefined && Number.isNaN(afterTime)) {
    return { ok: false, message: "--after must be a valid ISO 8601 datetime" }
  }
  if (value.before !== undefined && !iso8601UtcDateTimeRegex.test(value.before)) {
    return { ok: false, message: "--before must be a valid ISO 8601 datetime" }
  }
  const beforeTime = value.before === undefined ? undefined : new Date(value.before).getTime()
  if (beforeTime !== undefined && Number.isNaN(beforeTime)) {
    return { ok: false, message: "--before must be a valid ISO 8601 datetime" }
  }
  if (afterTime !== undefined && beforeTime !== undefined && afterTime > beforeTime) {
    return { ok: false, message: "--after must be before or equal to --before" }
  }

  const invalidSourceTypes =
    value.sourceTypes?.filter((sourceType) => !normalizeCustomerSourceFilterInput(sourceType)) ?? []
  if (invalidSourceTypes.length > 0) {
    return {
      ok: false,
      message: `Unknown source types: ${invalidSourceTypes.join(", ")}. Allowed: ${customerSourceTypeInputs.join(", ")}`,
    }
  }

  const normalizedSourceTypes = value.sourceTypes
    ? Array.from(
        new Set(
          value.sourceTypes.map((sourceType) => normalizeCustomerSourceFilterInput(sourceType)),
        ),
      ).filter((sourceType): sourceType is CustomerSourceFilterType => sourceType !== null)
    : undefined

  return {
    ok: true,
    request: {
      query: normalizedQuery,
      customer: value.customer,
      topK: value.topK,
      after: value.after,
      before: value.before,
      sourceTypes: normalizedSourceTypes,
    },
  }
}
