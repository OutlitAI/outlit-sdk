import {
  customerSourceTypeAliases,
  customerSourceTypeAliasMap,
  customerSourceTypeInputs,
  customerSourceTypes,
  publicToolContracts,
  publicToolNames,
  sourceTypes,
} from "./generated/contracts.js"

export type JsonSchema = Readonly<Record<string, unknown>>
export type PublicToolName = (typeof publicToolNames)[number]
export type PublicToolContract = (typeof publicToolContracts)[PublicToolName]
export type CustomerSourceType = (typeof customerSourceTypes)[number]
export type CustomerSourceTypeInput = (typeof customerSourceTypeInputs)[number]
/** A source type as the v2 context tools take and return it: lowercase (`calendar_event`). */
export type ToolSourceType = (typeof sourceTypes)[number]

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

/** The v2 wire spelling of a canonical source type: `CALENDAR_EVENT` is `calendar_event`. */
export function toToolSourceType(value: CustomerSourceType): ToolSourceType {
  return value.toLowerCase() as ToolSourceType
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

export type SearchArgsLike = {
  query?: string
  customer?: string | null
  limit?: number
  /** The previous spelling of `limit`, still read when `limit` is absent. */
  topK?: number
  after?: string
  before?: string
  sourceTypes?: string[]
}

/** The `outlit_search_customer_context` input: source types, `after` and `before` sit under `filters`. */
export type CustomerContextSearchInput = {
  query: string
  customer?: string | null
  limit?: number
  filters?: {
    sourceTypes?: ToolSourceType[]
    after?: string
    before?: string
  }
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
    value.sourceTypes?.filter((sourceType) => !normalizeCustomerSourceType(sourceType)) ?? []
  if (invalidSourceTypes.length > 0) {
    return {
      ok: false,
      message: `Unknown source types: ${invalidSourceTypes.join(", ")}. Allowed: ${sourceTypes.join(", ")}`,
    }
  }

  const normalizedSourceTypes = value.sourceTypes
    ? Array.from(
        new Set(
          value.sourceTypes
            .map((sourceType) => normalizeCustomerSourceType(sourceType))
            .filter((sourceType): sourceType is CustomerSourceType => sourceType !== null)
            .map(toToolSourceType),
        ),
      )
    : undefined
  const filters: NonNullable<CustomerContextSearchInput["filters"]> = {
    ...(normalizedSourceTypes ? { sourceTypes: normalizedSourceTypes } : {}),
    ...(value.after !== undefined ? { after: value.after } : {}),
    ...(value.before !== undefined ? { before: value.before } : {}),
  }
  const limit = value.limit ?? value.topK

  return {
    ok: true,
    request: {
      query: normalizedQuery,
      ...(value.customer !== undefined ? { customer: value.customer } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    },
  }
}
