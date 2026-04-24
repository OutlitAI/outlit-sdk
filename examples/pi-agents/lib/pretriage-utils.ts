import {
  createOutlitClient,
  DEFAULT_OUTLIT_API_URL,
  type OutlitToolsClient,
  type OutlitToolsFetch,
} from "@outlit/tools"

export const OUTLIT_API_KEY_ENV = "OUTLIT_API_KEY"
export const OUTLIT_API_URL_ENV = "OUTLIT_API_URL"

export type QueryClient = Pick<OutlitToolsClient, "callTool">

export type PretriageClientOptions = {
  apiKey?: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
}

export type BillingScope = {
  billingStatuses: readonly string[]
}

export type BillingScopeFilter = {
  customers: string
  activity: string
  users: string
}

export function createPretriageClient(
  options: PretriageClientOptions,
  toolLabel: string,
): QueryClient {
  return createOutlitClient({
    apiKey: resolveApiKey(options, toolLabel),
    baseUrl: resolveBaseUrl(options),
    fetch: options.fetch,
  })
}

export function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function normalizeNow(now: Date | string | undefined): Date {
  if (now instanceof Date) {
    return now
  }

  if (typeof now === "string") {
    const date = new Date(now)
    if (Number.isNaN(date.getTime())) {
      throw new Error("now must be a valid date")
    }

    return date
  }

  return new Date()
}

export function normalizeToolInput(params: unknown, toolLabel: string): Record<string, unknown> {
  if (params === undefined) {
    return {}
  }

  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    throw new TypeError(`Outlit ${toolLabel} pretriage input must be an object`)
  }

  return params as Record<string, unknown>
}

export function normalizeMaxPromptCustomers(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error("maxPromptCustomers must be an integer from 1 to 50")
  }

  return value
}

export async function queryRows<TRow>(client: QueryClient, sql: string): Promise<TRow[]> {
  const result = await client.callTool("outlit_query", { sql, limit: 10000 })

  if (!isRecord(result)) {
    throw new Error("outlit_query returned an unexpected response")
  }

  const rows = result.rows ?? result.data
  if (!Array.isArray(rows)) {
    throw new Error("outlit_query response must include rows")
  }

  return rows as TRow[]
}

export function buildBillingScopeFilter(scope: BillingScope): BillingScopeFilter {
  if (scope.billingStatuses.length === 0) {
    return {
      customers: "1 = 1",
      activity: "1 = 1",
      users: "1 = 1",
    }
  }

  const statuses = toSqlStringList(scope.billingStatuses)

  return {
    customers: `billing_status IN (${statuses})`,
    activity: `customer_id IN (
      SELECT customer_id
      FROM customers
      WHERE billing_status IN (${statuses})
    )`,
    users: `customer_id IN (
      SELECT customer_id
      FROM customers
      WHERE billing_status IN (${statuses})
    )`,
  }
}

export function assertStringArray(
  value: unknown,
  path: string,
  maxLength = 500,
): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`)
  }

  for (const item of value) {
    if (typeof item !== "string" || item.length > maxLength) {
      throw new Error(`${path} must contain strings shorter than ${maxLength} characters`)
    }
  }
}

export function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`)
  }
}

export function assertPositiveInteger(value: unknown, path: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${path} must be a positive integer`)
  }
}

export function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${path} must be a non-negative integer`)
  }
}

export function assertOptionalPositiveInteger(
  value: unknown,
  path: string,
): asserts value is number | undefined {
  if (value === undefined) {
    return
  }

  assertPositiveInteger(value, path)
}

export function assertOptionalNonNegativeInteger(
  value: unknown,
  path: string,
): asserts value is number | undefined {
  if (value === undefined) {
    return
  }

  assertNonNegativeInteger(value, path)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function toSqlStringList(values: readonly string[]): string {
  return values.map((value) => `'${escapeSqlString(value)}'`).join(", ")
}

export function toSqlDateTime(date: Date): string {
  return `parseDateTimeBestEffort('${escapeSqlString(date.toISOString())}')`
}

export function escapeSqlString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "''")
}

export function normalizeEventNames(eventNames: string[]): string[] {
  return eventNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
}

export function buildFingerprint(stateKeys: string[]): string {
  return [...stateKeys].sort().join(",")
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

export function parseOutlitDate(value: string): Date {
  const date = new Date(hasExplicitTimezone(value) ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date returned by Outlit query: ${value}`)
  }

  return date
}

function resolveApiKey(options: PretriageClientOptions, toolLabel: string): string {
  const apiKey = normalizeString(options.apiKey) ?? normalizeString(process.env[OUTLIT_API_KEY_ENV])

  if (!apiKey) {
    throw new Error(`${OUTLIT_API_KEY_ENV} is required to run Outlit ${toolLabel} pretriage`)
  }

  return apiKey
}

function resolveBaseUrl(options: PretriageClientOptions): string {
  return (
    normalizeString(options.baseUrl) ??
    normalizeString(process.env[OUTLIT_API_URL_ENV]) ??
    DEFAULT_OUTLIT_API_URL
  )
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
}
