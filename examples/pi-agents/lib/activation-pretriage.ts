import type { AgentToolResult, ToolDefinition } from "@mariozechner/pi-coding-agent"
import {
  createOutlitClient,
  DEFAULT_OUTLIT_API_URL,
  type OutlitToolsClient,
  type OutlitToolsFetch,
} from "@outlit/tools"
import type { TSchema } from "@sinclair/typebox"

const OUTLIT_API_KEY_ENV = "OUTLIT_API_KEY"
const OUTLIT_API_URL_ENV = "OUTLIT_API_URL"

const activationPretriageToolParameters = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    scopeProfile: {
      description:
        "Which configured customer scope to scan. Use activation_accounts for trial, unpaid, and early paying activation scans.",
      type: "string",
      enum: ["configured", "activation_accounts", "all_accounts"],
      default: "activation_accounts",
    },
    maxPromptCustomers: {
      description: "Maximum surfaced customers to include in the prompt context.",
      type: "number",
      minimum: 1,
      maximum: 50,
      default: 5,
    },
  },
  additionalProperties: false,
} as const

export type ActivationBillingStatus = "NONE" | "TRIALING" | "PAYING" | "PAST_DUE" | "CHURNED"
export type ActivationScopeProfile = "configured" | "activation_accounts" | "all_accounts"

export type ActivationScope = {
  billingStatuses: ActivationBillingStatus[]
}

export type OutlitActivationPretriageConfig = {
  version: 1
  scopeProfiles: {
    activation_accounts: ActivationScope
    all_accounts: ActivationScope
  }
  defaults: {
    scope: ActivationScope
    minimumAccountAgeDays: number
    staleAfterDays: number
    recentActivityWindowDays: number
    activatedStages: Array<"ACTIVATED" | "ENGAGED">
    activationEventNames: string[]
  }
}

type ResolvedActivationPretriageConfig = OutlitActivationPretriageConfig["defaults"]

type CustomerDirectoryRow = {
  customerId: string
  customerName: string | null
  domain: string | null
  billingStatus: ActivationBillingStatus | null
  mrrCents: number | null
}

type UserActivationRow = {
  customerId: string
  usersObserved: number
  activatedUsers: number
  firstUserSeenAt: string | null
  lastUserActivityAt: string | null
}

type EventActivationRow = {
  customerId: string
  firstProductEventAt: string | null
  lastProductEventAt: string | null
  recentEventCount: number
  recentActiveDays: number
  activationEventCount: number
}

export type OutlitActivationPretriageSignal = {
  key: "noActivatedUsers" | "noActivationEvent" | "noRecentProductActivity" | "stalledAfterSignup"
  summary: string
  value?: number
  previousValue?: number
}

export type OutlitActivationPretriageCustomer = {
  customerId: string
  customerName: string | null
  domain: string | null
  billingStatus: ActivationBillingStatus | null
  mrrCents: number | null
  signals: OutlitActivationPretriageSignal[]
  activationBaseline: {
    usersObserved: number
    activatedUsers: number
    activationEventCount: number
    firstUserSeenAt: string | null
    lastUserActivityAt: string | null
    firstProductEventAt: string | null
    lastProductEventAt: string | null
    recentEventCount: number
    recentActiveDays: number
  }
  fingerprint: string
}

export type OutlitActivationPretriageResult = {
  enabled: true
  generatedAt: string
  scopeProfile: ActivationScopeProfile
  scope: ActivationScope
  summary: {
    totalSurfacedCustomers: number
    customersIncludedThisRun: number
    deferredCustomers: number
  }
  surfacedCustomers: OutlitActivationPretriageCustomer[]
  context: string
}

export type OutlitActivationPretriageRunnerOptions = {
  apiKey?: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
  client?: Pick<OutlitToolsClient, "callTool">
  config?: OutlitActivationPretriageConfig
  now?: Date | string
  scopeProfile?: ActivationScopeProfile
  maxPromptCustomers?: number
}

export type OutlitActivationPretriageToolOptions = Omit<
  OutlitActivationPretriageRunnerOptions,
  "scopeProfile" | "maxPromptCustomers"
>

export type OutlitActivationPretriageToolDetails = {
  toolName: "outlit_activation_pretriage"
  result: OutlitActivationPretriageResult
}

export type OutlitActivationPretriageToolDefinition = ToolDefinition<
  TSchema,
  OutlitActivationPretriageToolDetails
>

type QueryClient = Pick<OutlitToolsClient, "callTool">

export const defaultActivationPretriageConfig: OutlitActivationPretriageConfig = {
  version: 1,
  scopeProfiles: {
    activation_accounts: {
      billingStatuses: ["NONE", "TRIALING", "PAYING"],
    },
    all_accounts: {
      billingStatuses: [],
    },
  },
  defaults: {
    scope: {
      billingStatuses: ["NONE", "TRIALING", "PAYING"],
    },
    minimumAccountAgeDays: 3,
    staleAfterDays: 7,
    recentActivityWindowDays: 14,
    activatedStages: ["ACTIVATED", "ENGAGED"],
    activationEventNames: ["activated", "stage:activated", "user_activated"],
  },
}

export async function runOutlitActivationPretriage(
  options: OutlitActivationPretriageRunnerOptions,
): Promise<OutlitActivationPretriageResult> {
  const now = normalizeNow(options.now)
  const config = validateActivationPretriageConfig(
    options.config ?? defaultActivationPretriageConfig,
  )
  const scopeProfile = options.scopeProfile ?? "activation_accounts"
  const resolvedScope = resolveScope(config, scopeProfile)
  const resolvedConfig: ResolvedActivationPretriageConfig = {
    ...config.defaults,
    scope: resolvedScope,
  }
  const client = options.client ?? createRunnerClient(options)
  const loadedData = await loadActivationData({
    client,
    config: resolvedConfig,
    now,
  })

  const surfacedCustomers = finalizeActivationCustomers({
    now,
    config: resolvedConfig,
    customerDirectory: loadedData.customerDirectory,
    userActivationRows: loadedData.userActivationRows,
    eventActivationRows: loadedData.eventActivationRows,
  })
  const maxPromptCustomers = options.maxPromptCustomers ?? 5
  const includedCustomers = surfacedCustomers.slice(0, maxPromptCustomers)
  const summary = {
    totalSurfacedCustomers: surfacedCustomers.length,
    customersIncludedThisRun: includedCustomers.length,
    deferredCustomers: Math.max(surfacedCustomers.length - includedCustomers.length, 0),
  }

  return {
    enabled: true,
    generatedAt: now.toISOString(),
    scopeProfile,
    scope: resolvedScope,
    summary,
    surfacedCustomers: includedCustomers,
    context: buildDeterministicActivationPretriageContext({
      generatedAt: now,
      summary,
      customers: includedCustomers,
    }),
  }
}

export function createOutlitActivationPretriageTool(
  options: OutlitActivationPretriageToolOptions = {},
): OutlitActivationPretriageToolDefinition {
  return {
    name: "outlit_activation_pretriage",
    label: "Outlit Activation Pretriage",
    description:
      "Run deterministic activation-risk pretriage with user journey stage and activation-event checks before deeper account review.",
    promptSnippet:
      "Outlit Activation Pretriage: deterministically surfaces accounts that have not reached first value.",
    parameters: activationPretriageToolParameters as unknown as TSchema,
    async execute(_toolCallId, params) {
      const input = normalizeToolInput(params)
      const result = await runOutlitActivationPretriage({
        ...options,
        scopeProfile: normalizeScopeProfile(input.scopeProfile),
        maxPromptCustomers: normalizeMaxPromptCustomers(input.maxPromptCustomers),
      })

      return formatActivationToolResult(result)
    },
  }
}

function createRunnerClient(options: OutlitActivationPretriageRunnerOptions): QueryClient {
  return createOutlitClient({
    apiKey: resolveApiKey(options),
    baseUrl: resolveBaseUrl(options),
    fetch: options.fetch,
  })
}

function resolveApiKey(options: OutlitActivationPretriageRunnerOptions): string {
  const apiKey = normalizeString(options.apiKey) ?? normalizeString(process.env[OUTLIT_API_KEY_ENV])

  if (!apiKey) {
    throw new Error(`${OUTLIT_API_KEY_ENV} is required to run Outlit activation pretriage`)
  }

  return apiKey
}

function resolveBaseUrl(options: OutlitActivationPretriageRunnerOptions): string {
  return (
    normalizeString(options.baseUrl) ??
    normalizeString(process.env[OUTLIT_API_URL_ENV]) ??
    DEFAULT_OUTLIT_API_URL
  )
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeNow(now: Date | string | undefined): Date {
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

function normalizeToolInput(params: unknown): Record<string, unknown> {
  if (params === undefined) {
    return {}
  }

  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    throw new TypeError("Outlit activation pretriage input must be an object")
  }

  return params as Record<string, unknown>
}

function normalizeScopeProfile(value: unknown): ActivationScopeProfile | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === "configured" || value === "activation_accounts" || value === "all_accounts") {
    return value
  }

  throw new Error("scopeProfile must be configured, activation_accounts, or all_accounts")
}

function normalizeMaxPromptCustomers(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error("maxPromptCustomers must be an integer from 1 to 50")
  }

  return value
}

function formatActivationToolResult(
  result: OutlitActivationPretriageResult,
): AgentToolResult<OutlitActivationPretriageToolDetails> {
  return {
    content: [{ type: "text", text: result.context }],
    details: {
      toolName: "outlit_activation_pretriage",
      result,
    },
  }
}

function validateActivationPretriageConfig(
  config: OutlitActivationPretriageConfig,
): OutlitActivationPretriageConfig {
  if (!isRecord(config)) {
    throw new Error("activation pretriage config must be an object")
  }

  if (config.version !== 1) {
    throw new Error("activation pretriage config version must be 1")
  }

  validateScope(config.defaults.scope, "defaults.scope")
  validateScope(config.scopeProfiles.activation_accounts, "scopeProfiles.activation_accounts")
  validateScope(config.scopeProfiles.all_accounts, "scopeProfiles.all_accounts")
  assertNonNegativeInteger(config.defaults.minimumAccountAgeDays, "minimumAccountAgeDays")
  assertPositiveInteger(config.defaults.staleAfterDays, "staleAfterDays")
  assertPositiveInteger(config.defaults.recentActivityWindowDays, "recentActivityWindowDays")
  assertStringArray(config.defaults.activationEventNames, "activationEventNames")

  return config
}

function validateScope(scope: ActivationScope, path: string): void {
  if (!Array.isArray(scope.billingStatuses)) {
    throw new Error(`${path}.billingStatuses must be an array`)
  }

  for (const status of scope.billingStatuses) {
    assertBillingStatus(status, `${path}.billingStatuses`)
  }
}

function assertBillingStatus(
  value: unknown,
  path: string,
): asserts value is ActivationBillingStatus {
  if (
    value !== "NONE" &&
    value !== "TRIALING" &&
    value !== "PAYING" &&
    value !== "PAST_DUE" &&
    value !== "CHURNED"
  ) {
    throw new Error(`${path} contains an unsupported billing status`)
  }
}

function assertPositiveInteger(value: unknown, path: string): void {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${path} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value: unknown, path: string): void {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${path} must be a non-negative integer`)
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${path} must be an array of strings`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function resolveScope(
  config: OutlitActivationPretriageConfig,
  scopeProfile: ActivationScopeProfile,
): ActivationScope {
  if (scopeProfile === "configured") {
    return config.defaults.scope
  }

  return config.scopeProfiles[scopeProfile]
}

async function loadActivationData(params: {
  client: QueryClient
  config: ResolvedActivationPretriageConfig
  now: Date
}): Promise<{
  customerDirectory: Map<string, CustomerDirectoryRow>
  userActivationRows: Map<string, UserActivationRow>
  eventActivationRows: Map<string, EventActivationRow>
}> {
  const sqlParts = buildSqlParts(params.config)
  const [customerDirectoryRows, userActivationRows, eventActivationRows] = await Promise.all([
    queryRows<CustomerDirectoryRow>(params.client, buildCustomerDirectorySql(sqlParts)),
    queryRows<UserActivationRow>(params.client, buildUserActivationSql(sqlParts, params.config)),
    queryRows<EventActivationRow>(
      params.client,
      buildEventActivationSql(sqlParts, params.config, params.now),
    ),
  ])

  return {
    customerDirectory: new Map(
      customerDirectoryRows.map((row) => [row.customerId, normalizeCustomerDirectoryRow(row)]),
    ),
    userActivationRows: new Map(
      userActivationRows.map((row) => [row.customerId, normalizeUserActivationRow(row)]),
    ),
    eventActivationRows: new Map(
      eventActivationRows.map((row) => [row.customerId, normalizeEventActivationRow(row)]),
    ),
  }
}

async function queryRows<TRow>(client: QueryClient, sql: string): Promise<TRow[]> {
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

type SqlParts = {
  customerScopeFilter: string
  eventScopeFilter: string
  userScopeFilter: string
}

function buildSqlParts(config: ResolvedActivationPretriageConfig): SqlParts {
  const scopeFilter = buildScopeFilter(config.scope)

  return {
    customerScopeFilter: scopeFilter.customerDimensions,
    eventScopeFilter: scopeFilter.events,
    userScopeFilter: scopeFilter.userDimensions,
  }
}

function buildScopeFilter(scope: ActivationScope): {
  customerDimensions: string
  events: string
  userDimensions: string
} {
  if (scope.billingStatuses.length === 0) {
    return {
      customerDimensions: "1 = 1",
      events: "1 = 1",
      userDimensions: "1 = 1",
    }
  }

  const statuses = toSqlStringList(scope.billingStatuses)

  return {
    customerDimensions: `billing_status IN (${statuses})`,
    events: `customer_id IN (
      SELECT customer_id
      FROM customer_dimensions
      WHERE billing_status IN (${statuses})
    )`,
    userDimensions: `customer_id IN (
      SELECT customer_id
      FROM customer_dimensions
      WHERE billing_status IN (${statuses})
    )`,
  }
}

function buildCustomerDirectorySql(sqlParts: SqlParts): string {
  return `
    SELECT
      customer_id AS customerId,
      any(name) AS customerName,
      any(domain) AS domain,
      any(billing_status) AS billingStatus,
      any(mrr_cents) AS mrrCents
    FROM customer_dimensions
    WHERE customer_id != ''
      AND ${sqlParts.customerScopeFilter}
    GROUP BY customer_id
    ORDER BY mrrCents DESC
    LIMIT 10000
  `
}

function buildUserActivationSql(
  sqlParts: SqlParts,
  config: ResolvedActivationPretriageConfig,
): string {
  return `
    SELECT
      customer_id AS customerId,
      countDistinct(user_id) AS usersObserved,
      countDistinctIf(user_id, journey_stage IN (${toSqlStringList(config.activatedStages)})) AS activatedUsers,
      min(first_seen_at) AS firstUserSeenAt,
      max(last_activity_at) AS lastUserActivityAt
    FROM user_dimensions
    WHERE customer_id != ''
      AND user_id != ''
      AND ${sqlParts.userScopeFilter}
    GROUP BY customer_id
    LIMIT 10000
  `
}

function buildEventActivationSql(
  sqlParts: SqlParts,
  config: ResolvedActivationPretriageConfig,
  now: Date,
): string {
  const sqlNow = toSqlDateTime(now)

  return `
    SELECT
      customer_id AS customerId,
      min(occurred_at) AS firstProductEventAt,
      max(occurred_at) AS lastProductEventAt,
      countIf(occurred_at >= ${sqlNow} - INTERVAL ${config.recentActivityWindowDays} DAY) AS recentEventCount,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= ${sqlNow} - INTERVAL ${config.recentActivityWindowDays} DAY
      ) AS recentActiveDays,
      countIf(lower(trim(event_name)) IN (${toSqlStringList(normalizeEventNames(config.activationEventNames))})) AS activationEventCount
    FROM events
    WHERE occurred_at <= ${sqlNow}
      AND customer_id != ''
      AND ${sqlParts.eventScopeFilter}
    GROUP BY customer_id
    LIMIT 10000
  `
}

function finalizeActivationCustomers(params: {
  now: Date
  config: ResolvedActivationPretriageConfig
  customerDirectory: Map<string, CustomerDirectoryRow>
  userActivationRows: Map<string, UserActivationRow>
  eventActivationRows: Map<string, EventActivationRow>
}): OutlitActivationPretriageCustomer[] {
  const customers: OutlitActivationPretriageCustomer[] = []

  for (const customer of params.customerDirectory.values()) {
    const userRow = params.userActivationRows.get(customer.customerId)
    const eventRow = params.eventActivationRows.get(customer.customerId)
    const usersObserved = userRow?.usersObserved ?? 0
    const activatedUsers = userRow?.activatedUsers ?? 0
    const activationEventCount = eventRow?.activationEventCount ?? 0

    if (usersObserved <= 0 || activatedUsers > 0 || activationEventCount > 0) {
      continue
    }

    const accountAgeDays = daysSince(params.now, userRow?.firstUserSeenAt)
    if (accountAgeDays !== null && accountAgeDays < params.config.minimumAccountAgeDays) {
      continue
    }

    const recentEventCount = eventRow?.recentEventCount ?? 0
    const lastUserActivityDays = daysSince(params.now, userRow?.lastUserActivityAt)
    const signals = buildSignals({
      config: params.config,
      usersObserved,
      activatedUsers,
      activationEventCount,
      recentEventCount,
      recentActiveDays: eventRow?.recentActiveDays ?? 0,
      lastUserActivityDays,
    })

    if (signals.length === 0) {
      continue
    }

    customers.push({
      ...customer,
      signals,
      activationBaseline: {
        usersObserved,
        activatedUsers,
        activationEventCount,
        firstUserSeenAt: userRow?.firstUserSeenAt ?? null,
        lastUserActivityAt: userRow?.lastUserActivityAt ?? null,
        firstProductEventAt: eventRow?.firstProductEventAt ?? null,
        lastProductEventAt: eventRow?.lastProductEventAt ?? null,
        recentEventCount,
        recentActiveDays: eventRow?.recentActiveDays ?? 0,
      },
      fingerprint: buildFingerprint(customer, signals),
    })
  }

  return customers.sort(compareActivationCustomers)
}

function buildSignals(params: {
  config: ResolvedActivationPretriageConfig
  usersObserved: number
  activatedUsers: number
  activationEventCount: number
  recentEventCount: number
  recentActiveDays: number
  lastUserActivityDays: number | null
}): OutlitActivationPretriageSignal[] {
  const signals: OutlitActivationPretriageSignal[] = [
    {
      key: "noActivatedUsers",
      summary: `${params.usersObserved} observed users, but 0 are in ACTIVATED or ENGAGED journey stages.`,
      value: params.activatedUsers,
      previousValue: params.usersObserved,
    },
    {
      key: "noActivationEvent",
      summary: "No normalized activation event was found for this customer.",
      value: params.activationEventCount,
    },
  ]

  if (params.recentEventCount === 0) {
    signals.push({
      key: "noRecentProductActivity",
      summary: `0 product events in the last ${params.config.recentActivityWindowDays} days.`,
      value: params.recentEventCount,
    })
  } else if (params.recentActiveDays <= 1) {
    signals.push({
      key: "noRecentProductActivity",
      summary: `${params.recentActiveDays} active product days in the last ${params.config.recentActivityWindowDays} days.`,
      value: params.recentActiveDays,
    })
  }

  if (
    params.lastUserActivityDays !== null &&
    params.lastUserActivityDays >= params.config.staleAfterDays
  ) {
    signals.push({
      key: "stalledAfterSignup",
      summary: `Last observed user activity was ${params.lastUserActivityDays} days ago.`,
      value: params.lastUserActivityDays,
    })
  }

  return signals
}

function compareActivationCustomers(
  left: OutlitActivationPretriageCustomer,
  right: OutlitActivationPretriageCustomer,
): number {
  const statusDiff = billingStatusRank(left.billingStatus) - billingStatusRank(right.billingStatus)
  if (statusDiff !== 0) return statusDiff

  const signalDiff = right.signals.length - left.signals.length
  if (signalDiff !== 0) return signalDiff

  const revenueDiff = (right.mrrCents ?? 0) - (left.mrrCents ?? 0)
  if (revenueDiff !== 0) return revenueDiff

  return left.customerId.localeCompare(right.customerId)
}

function billingStatusRank(status: ActivationBillingStatus | null): number {
  if (status === "TRIALING") return 0
  if (status === "NONE") return 1
  if (status === "PAYING") return 2
  if (status === "PAST_DUE") return 3
  if (status === "CHURNED") return 4
  return 5
}

function buildDeterministicActivationPretriageContext(params: {
  generatedAt: Date
  summary: OutlitActivationPretriageResult["summary"]
  customers: OutlitActivationPretriageCustomer[]
}): string {
  if (params.summary.totalSurfacedCustomers === 0) {
    return `Deterministic activation pretriage ran at ${params.generatedAt.toISOString()}, but no customers met the configured activation-risk thresholds.

Candidate accounting:
- Reviewed 0 deterministic pretriage candidates.
- Ranked 0 customers from deterministic pretriage.
- Do not rank a customer from this pass unless the user explicitly asks for a broader scan and richer Outlit evidence supports it.`
  }

  const payload = {
    summary: params.summary,
    customers: params.customers.map(toPromptActivationCustomer),
  }

  return `DETERMINISTIC ACTIVATION PRETRIAGE RESULTS:
- These customers were surfaced by deterministic user-stage and activation-event checks before the model review.
- The payload's activation metrics are hard behavior evidence from product event and user journey data.
- Treat these customers as the investigation set for this activation run. Do not add unrelated customers unless the user explicitly asks for a broader scan.
- You may drop a listed customer only if richer Outlit evidence clearly contradicts the activation risk.
- Candidate accounting is required in the final answer: state how many pretriage candidates were reviewed, how many were ranked, and how many were excluded.
- Do not rank a customer unless you can cite at least one hard activation gap and one supporting evidence point from Outlit tools or the pretriage payload.
- Do not expose the words "heuristic", "deterministic pretriage", "SQL", or internal event names in final customer-facing recommendations.
BEGIN_ACTIVATION_PRETRIAGE_JSON
${JSON.stringify(payload, null, 2)}
END_ACTIVATION_PRETRIAGE_JSON`
}

function toPromptActivationCustomer(customer: OutlitActivationPretriageCustomer) {
  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    domain: customer.domain,
    billingStatus: customer.billingStatus,
    mrrCents: customer.mrrCents,
    signals: customer.signals,
    activationBaseline: customer.activationBaseline,
  }
}

function normalizeCustomerDirectoryRow(row: CustomerDirectoryRow): CustomerDirectoryRow {
  return {
    ...row,
    mrrCents: row.mrrCents === null ? null : Number(row.mrrCents),
  }
}

function normalizeUserActivationRow(row: UserActivationRow): UserActivationRow {
  return {
    ...row,
    usersObserved: Number(row.usersObserved),
    activatedUsers: Number(row.activatedUsers),
  }
}

function normalizeEventActivationRow(row: EventActivationRow): EventActivationRow {
  return {
    ...row,
    recentEventCount: Number(row.recentEventCount),
    recentActiveDays: Number(row.recentActiveDays),
    activationEventCount: Number(row.activationEventCount),
  }
}

function daysSince(now: Date, value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)))
}

function buildFingerprint(
  customer: CustomerDirectoryRow,
  signals: OutlitActivationPretriageSignal[],
): string {
  return [
    customer.customerId,
    customer.billingStatus ?? "UNKNOWN",
    ...signals.map((signal) => `${signal.key}:${signal.value ?? ""}`),
  ].join("|")
}

function toSqlDateTime(date: Date): string {
  return `parseDateTimeBestEffort('${escapeSqlString(date.toISOString())}')`
}

function toSqlStringList(values: readonly string[]): string {
  return values.map((value) => `'${escapeSqlString(value)}'`).join(", ")
}

function escapeSqlString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "''")
}

function normalizeEventNames(eventNames: string[]): string[] {
  return eventNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
}
