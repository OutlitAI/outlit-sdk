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
  sourceTypes?: CustomerSourceType[]
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
      message: `Unknown source types: ${invalidSourceTypes.join(", ")}. Allowed: ${customerSourceTypeInputs.join(", ")}`,
    }
  }

  const normalizedSourceTypes = value.sourceTypes
    ? Array.from(
        new Set(value.sourceTypes.map((sourceType) => normalizeCustomerSourceType(sourceType))),
      ).filter((sourceType): sourceType is CustomerSourceType => sourceType !== null)
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
