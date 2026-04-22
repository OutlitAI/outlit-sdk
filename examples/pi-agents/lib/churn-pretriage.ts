import { readFile } from "node:fs/promises"

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
const ACTIVITY_LOOKBACK_DAYS = 365
const DEFAULT_PROMPT_ROTATION_WINDOW_HOURS = 1

const churnPretriageToolParameters = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    scopeProfile: {
      description:
        "Which configured customer scope to scan. Use revenue_accounts for paying-account churn scans.",
      type: "string",
      enum: ["configured", "revenue_accounts", "all_accounts", "auto"],
      default: "revenue_accounts",
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

export type ChurnBillingStatus = "NONE" | "TRIALING" | "PAYING" | "PAST_DUE" | "CHURNED"
export type ChurnDisposition = "investigate" | "likely_churn"
export type ChurnScopeProfile = "configured" | "revenue_accounts" | "all_accounts" | "auto"

export type ChurnScope = {
  billingStatuses: ChurnBillingStatus[]
}

export type ChurnPretriageConfig = {
  version: 2
  scopeProfiles: {
    all_accounts: ChurnScope
    revenue_accounts: ChurnScope
  }
  autoScopeSchedule: {
    intervalHours: number
    scopeOrder: Array<"all_accounts" | "revenue_accounts">
  }
  promptSelection?: {
    rotationWindowHours?: number
  }
  defaults: {
    scope: ChurnScope
    activityDefinition: {
      includeEventNames: string[]
      excludeEventNames: string[]
      fallbackMode: "all_non_excluded_events"
    }
    customerHeuristics: {
      pastDueBillingStatus: {
        enabled: boolean
        disposition: ChurnDisposition
        reminderWindowDays?: number
      }
      daysSinceLastMeaningfulActivity: {
        enabled: boolean
        thresholds: Array<{
          days: number
          disposition: ChurnDisposition
          reminderWindowDays?: number
        }>
      }
      activeDaysLast30d: {
        enabled: boolean
        minimumCustomerAgeDays: number
        thresholds: Array<{
          maxDays: number
          disposition: ChurnDisposition
          reminderWindowDays?: number
        }>
      }
      dropVsBaseline: {
        enabled: boolean
        windowDays: number
        baselineDays: number
        minimumBaselineActiveDays: number
        minimumBaselineEventCount: number
        dropPercent: number
        disposition: ChurnDisposition
        reminderWindowDays?: number
      }
    }
    userHeuristics: {
      daysSinceLastMeaningfulActivity: {
        enabled: boolean
        minimumPriorActiveDays?: number
        thresholds: Array<{
          days: number
          disposition: ChurnDisposition
          reminderWindowDays?: number
        }>
      }
      allRecentlyActiveUsersNowInactive: {
        enabled: boolean
        lookbackDays: number
        inactiveDays: number
        minimumPreviouslyActiveUsers: number
        minimumPriorActiveDays: number
        disposition: ChurnDisposition
        reminderWindowDays?: number
      }
    }
  }
}

export type OutlitChurnPretriageConfig = ChurnPretriageConfig

type ResolvedChurnPretriageConfig = ChurnPretriageConfig["defaults"]

type CustomerDirectoryRow = {
  customerId: string
  customerName: string | null
  domain: string | null
  billingStatus: ChurnBillingStatus | null
  mrrCents: number | null
}

type CustomerActivityRow = {
  customerId: string
  firstMeaningfulActivityAt: string
  lastMeaningfulActivityAt: string
  activeDays30d: number
  eventCount30d: number
}

type CustomerDropRow = {
  customerId: string
  currentActiveDays: number
  currentEventCount: number
  baselineActiveDays: number
  baselineEventCount: number
}

type UserDirectoryRow = {
  customerId: string
  userId: string
  email: string | null
  name: string | null
}

type UserActivityRow = {
  customerId: string
  userId: string
  lastMeaningfulActivityAt: string
  activeDaysObserved: number
}

type UserInactivityRow = {
  customerId: string
  userId: string
  lastActivityBeforeInactiveWindow: string
  priorActiveDays: number
  priorEventCount: number
  recentEventCount: number
}

type HeuristicMatch = {
  level: "customer" | "user"
  key: string
  stateKey: string
  rank: number
  disposition: ChurnDisposition
  reminderWindowDays?: number
}

export type OutlitChurnCustomerHeuristic = {
  key: string
  disposition: ChurnDisposition
  value?: number
  previousValue?: number
  summary: string
  reminderWindowDays?: number
}

export type OutlitChurnMatchedUser = {
  userId: string
  email: string | null
  name: string | null
  daysSinceLastMeaningfulActivity?: number
}

export type OutlitChurnUserHeuristic = {
  key: string
  disposition: ChurnDisposition
  summary: string
  matchedUsers: OutlitChurnMatchedUser[]
}

export type OutlitChurnPretriageCustomer = {
  customerId: string
  customerName: string | null
  domain: string | null
  billingStatus: ChurnBillingStatus | null
  mrrCents: number | null
  disposition: ChurnDisposition
  customerHeuristics: OutlitChurnCustomerHeuristic[]
  userHeuristics: OutlitChurnUserHeuristic[]
  activityBaseline: {
    firstMeaningfulActivityAt: string
    lastMeaningfulActivityAt: string
    meaningfulActiveDays30d: number
    meaningfulEventCount30d: number
  } | null
  fingerprint: string
}

export type OutlitChurnPretriageResult = {
  enabled: true
  generatedAt: string
  scopeProfile: ChurnScopeProfile
  scope: ChurnScope
  summary: {
    totalSurfacedCustomers: number
    customersIncludedThisRun: number
    deferredCustomers: number
    suppressedCustomers: number
    likelyChurnCustomers: number
    investigateCustomers: number
  }
  surfacedCustomers: OutlitChurnPretriageCustomer[]
  context: string
}

export type OutlitChurnPretriageRunnerOptions = {
  apiKey?: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
  client?: Pick<OutlitToolsClient, "callTool">
  config?: ChurnPretriageConfig
  configPath?: string | URL
  now?: Date | string
  scopeProfile?: ChurnScopeProfile
  maxPromptCustomers?: number
}

export type OutlitChurnPretriageToolOptions = Omit<
  OutlitChurnPretriageRunnerOptions,
  "scopeProfile" | "maxPromptCustomers"
>

export type OutlitChurnPretriageToolDetails = {
  toolName: "outlit_churn_pretriage"
  result: OutlitChurnPretriageResult
}

export type OutlitChurnPretriageToolDefinition = ToolDefinition<
  TSchema,
  OutlitChurnPretriageToolDetails
>

type QueryClient = Pick<OutlitToolsClient, "callTool">

type CustomerAccumulator = {
  customersById: Map<string, InternalPretriageCustomer>
  ensureCustomer: (customerId: string) => InternalPretriageCustomer
}

type InternalPretriageCustomer = OutlitChurnPretriageCustomer & {
  internalMatches: HeuristicMatch[]
}

export const defaultChurnPretriageConfig: ChurnPretriageConfig = {
  version: 2,
  scopeProfiles: {
    all_accounts: {
      billingStatuses: [],
    },
    revenue_accounts: {
      billingStatuses: ["PAYING", "PAST_DUE"],
    },
  },
  autoScopeSchedule: {
    intervalHours: 6,
    scopeOrder: ["revenue_accounts", "all_accounts"],
  },
  promptSelection: {
    rotationWindowHours: DEFAULT_PROMPT_ROTATION_WINDOW_HOURS,
  },
  defaults: {
    scope: {
      billingStatuses: [],
    },
    activityDefinition: {
      includeEventNames: [],
      excludeEventNames: [
        "$autocapture",
        "$exception",
        "$feature_flag_called",
        "$groupidentify",
        "$identify",
        "$pageleave",
        "$rageclick",
        "$set",
        "$web_vitals",
      ],
      fallbackMode: "all_non_excluded_events",
    },
    customerHeuristics: {
      pastDueBillingStatus: {
        enabled: true,
        disposition: "likely_churn",
        reminderWindowDays: 7,
      },
      daysSinceLastMeaningfulActivity: {
        enabled: true,
        thresholds: [
          { days: 14, disposition: "investigate" },
          { days: 30, disposition: "likely_churn", reminderWindowDays: 14 },
          { days: 120, disposition: "likely_churn", reminderWindowDays: 7 },
        ],
      },
      activeDaysLast30d: {
        enabled: true,
        minimumCustomerAgeDays: 21,
        thresholds: [
          { maxDays: 4, disposition: "likely_churn", reminderWindowDays: 7 },
          { maxDays: 0, disposition: "likely_churn", reminderWindowDays: 7 },
        ],
      },
      dropVsBaseline: {
        enabled: true,
        windowDays: 14,
        baselineDays: 28,
        minimumBaselineActiveDays: 4,
        minimumBaselineEventCount: 20,
        dropPercent: 0.5,
        disposition: "investigate",
      },
    },
    userHeuristics: {
      daysSinceLastMeaningfulActivity: {
        enabled: true,
        minimumPriorActiveDays: 3,
        thresholds: [
          { days: 7, disposition: "investigate" },
          { days: 14, disposition: "investigate", reminderWindowDays: 14 },
        ],
      },
      allRecentlyActiveUsersNowInactive: {
        enabled: true,
        lookbackDays: 30,
        inactiveDays: 14,
        minimumPreviouslyActiveUsers: 2,
        minimumPriorActiveDays: 3,
        disposition: "investigate",
        reminderWindowDays: 14,
      },
    },
  },
}

export async function loadChurnPretriageConfigFromFile(
  configPath: string | URL,
): Promise<ChurnPretriageConfig> {
  const content = await readFile(configPath, "utf8")
  return validateChurnPretriageConfig(JSON.parse(content))
}

export async function runOutlitChurnPretriage(
  options: OutlitChurnPretriageRunnerOptions,
): Promise<OutlitChurnPretriageResult> {
  const now = normalizeNow(options.now)
  const config = validateChurnPretriageConfig(
    options.config ?? (await loadConfigOption(options.configPath)),
  )
  const scopeProfile = options.scopeProfile ?? "revenue_accounts"
  const resolvedScope = resolveScope(config, scopeProfile, now)
  const resolvedConfig: ResolvedChurnPretriageConfig = {
    ...config.defaults,
    scope: resolvedScope,
  }
  const client = options.client ?? createRunnerClient(options)
  const loadedData = await loadHeuristicData({
    client,
    config: resolvedConfig,
  })

  const { customersById, ensureCustomer } = createCustomerAccumulator(loadedData.customerDirectory)

  attachCustomerActivityBaselines({
    customerActivityRows: loadedData.customerActivityRows,
    ensureCustomer,
  })
  applyCustomerHeuristics({
    now,
    resolvedConfig,
    customerDirectory: loadedData.customerDirectory,
    customerActivityRows: loadedData.customerActivityRows,
    customerDropRows: loadedData.customerDropRows,
    ensureCustomer,
  })
  applyUserHeuristics({
    now,
    resolvedConfig,
    userDirectory: loadedData.userDirectory,
    userActivityRows: loadedData.userActivityRows,
    usersNowInactiveRows: loadedData.usersNowInactiveRows,
    ensureCustomer,
  })

  const surfacedCustomers = finalizeSurfacedCustomers(customersById)
  const maxPromptCustomers = options.maxPromptCustomers ?? 5
  const includedCustomers = selectCustomersForPrompt({
    customers: surfacedCustomers,
    maxPromptCustomers,
    now,
    rotationWindowHours: config.promptSelection?.rotationWindowHours,
  })
  const summary = buildPretriageSummary(surfacedCustomers, includedCustomers)

  return {
    enabled: true,
    generatedAt: now.toISOString(),
    scopeProfile,
    scope: resolvedScope,
    summary,
    surfacedCustomers: includedCustomers,
    context: buildDeterministicPretriageContext({
      generatedAt: now,
      summary,
      customers: includedCustomers,
    }),
  }
}

export function createOutlitChurnPretriageTool(
  options: OutlitChurnPretriageToolOptions = {},
): OutlitChurnPretriageToolDefinition {
  return {
    name: "outlit_churn_pretriage",
    label: "Outlit Churn Pretriage",
    description:
      "Run deterministic churn-risk pretriage with configurable usage, billing, and user-inactivity heuristics before deeper account review.",
    promptSnippet:
      "Outlit Churn Pretriage: deterministically surfaces likely churn candidates before review.",
    parameters: churnPretriageToolParameters as unknown as TSchema,
    async execute(_toolCallId, params) {
      const input = normalizeToolInput(params)
      const result = await runOutlitChurnPretriage({
        ...options,
        scopeProfile: normalizeScopeProfile(input.scopeProfile),
        maxPromptCustomers: normalizeMaxPromptCustomers(input.maxPromptCustomers),
      })

      return formatChurnToolResult(result)
    },
  }
}

async function loadConfigOption(
  configPath: string | URL | undefined,
): Promise<ChurnPretriageConfig> {
  if (configPath) {
    return loadChurnPretriageConfigFromFile(configPath)
  }

  return defaultChurnPretriageConfig
}

function createRunnerClient(options: OutlitChurnPretriageRunnerOptions): QueryClient {
  return createOutlitClient({
    apiKey: resolveApiKey(options),
    baseUrl: resolveBaseUrl(options),
    fetch: options.fetch,
  })
}

function resolveApiKey(options: OutlitChurnPretriageRunnerOptions): string {
  const apiKey = normalizeString(options.apiKey) ?? normalizeString(process.env[OUTLIT_API_KEY_ENV])

  if (!apiKey) {
    throw new Error(`${OUTLIT_API_KEY_ENV} is required to run Outlit churn pretriage`)
  }

  return apiKey
}

function resolveBaseUrl(options: OutlitChurnPretriageRunnerOptions): string {
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
    throw new TypeError("Outlit churn pretriage input must be an object")
  }

  return params as Record<string, unknown>
}

function normalizeScopeProfile(value: unknown): ChurnScopeProfile | undefined {
  if (value === undefined) {
    return undefined
  }

  if (
    value === "configured" ||
    value === "revenue_accounts" ||
    value === "all_accounts" ||
    value === "auto"
  ) {
    return value
  }

  throw new Error("scopeProfile must be configured, revenue_accounts, all_accounts, or auto")
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

function formatChurnToolResult(
  result: OutlitChurnPretriageResult,
): AgentToolResult<OutlitChurnPretriageToolDetails> {
  return {
    content: [{ type: "text", text: result.context }],
    details: {
      toolName: "outlit_churn_pretriage",
      result,
    },
  }
}

function validateChurnPretriageConfig(config: ChurnPretriageConfig): ChurnPretriageConfig {
  if (!isRecord(config)) {
    throw new Error("churn pretriage config must be an object")
  }

  if (config.version !== 2) {
    throw new Error("churn pretriage config version must be 2")
  }

  validateScope(config.defaults.scope, "defaults.scope")
  validateScope(config.scopeProfiles.all_accounts, "scopeProfiles.all_accounts")
  validateScope(config.scopeProfiles.revenue_accounts, "scopeProfiles.revenue_accounts")
  validateAutoScopeSchedule(config.autoScopeSchedule)
  validatePromptSelection(config.promptSelection)
  validateActivityDefinition(config.defaults.activityDefinition)
  validatePastDueBillingStatus(config.defaults.customerHeuristics.pastDueBillingStatus)
  validateThresholdHeuristic(
    config.defaults.customerHeuristics.daysSinceLastMeaningfulActivity,
    "customerHeuristics.daysSinceLastMeaningfulActivity",
  )
  validateActiveDaysLast30d(config.defaults.customerHeuristics.activeDaysLast30d)
  validateDropVsBaseline(config.defaults.customerHeuristics.dropVsBaseline)
  validateUserDaysSinceLastMeaningfulActivity(
    config.defaults.userHeuristics.daysSinceLastMeaningfulActivity,
  )
  validateAllRecentlyActiveUsersNowInactive(
    config.defaults.userHeuristics.allRecentlyActiveUsersNowInactive,
  )

  return config
}

function validateScope(scope: ChurnScope, path: string): void {
  if (!Array.isArray(scope.billingStatuses)) {
    throw new Error(`${path}.billingStatuses must be an array`)
  }

  for (const status of scope.billingStatuses) {
    assertBillingStatus(status, `${path}.billingStatuses`)
  }
}

function validateActivityDefinition(
  definition: ChurnPretriageConfig["defaults"]["activityDefinition"],
): void {
  if (definition.fallbackMode !== "all_non_excluded_events") {
    throw new Error("activityDefinition.fallbackMode must be all_non_excluded_events")
  }

  assertStringArray(definition.includeEventNames, "activityDefinition.includeEventNames")
  assertStringArray(definition.excludeEventNames, "activityDefinition.excludeEventNames")
}

function validateAutoScopeSchedule(config: ChurnPretriageConfig["autoScopeSchedule"]): void {
  if (!isRecord(config)) {
    throw new Error("autoScopeSchedule must be an object")
  }

  if (
    !Number.isInteger(config.intervalHours) ||
    config.intervalHours <= 0 ||
    24 % config.intervalHours !== 0
  ) {
    throw new Error("autoScopeSchedule.intervalHours must be a positive divisor of 24")
  }

  if (!Array.isArray(config.scopeOrder) || config.scopeOrder.length === 0) {
    throw new Error("autoScopeSchedule.scopeOrder must be a non-empty array")
  }

  for (const scope of config.scopeOrder) {
    if (scope !== "all_accounts" && scope !== "revenue_accounts") {
      throw new Error("autoScopeSchedule.scopeOrder contains an unsupported scope")
    }
  }
}

function validatePastDueBillingStatus(
  heuristic: ChurnPretriageConfig["defaults"]["customerHeuristics"]["pastDueBillingStatus"],
): void {
  if (!isRecord(heuristic)) {
    throw new Error("pastDueBillingStatus must be an object")
  }

  assertBoolean(heuristic.enabled, "pastDueBillingStatus.enabled")
  assertDisposition(heuristic.disposition)
  assertOptionalPositiveInteger(
    heuristic.reminderWindowDays,
    "pastDueBillingStatus.reminderWindowDays",
  )
}

function validateThresholdHeuristic(
  heuristic: {
    enabled: boolean
    thresholds: Array<{
      days: number
      disposition: ChurnDisposition
      reminderWindowDays?: number
    }>
  },
  path: string,
): void {
  if (!isRecord(heuristic)) {
    throw new Error(`${path} must be an object`)
  }

  assertBoolean(heuristic.enabled, `${path}.enabled`)
  validateThresholds(heuristic.thresholds, path)
}

function validateThresholds(
  thresholds: Array<{ days: number; disposition: ChurnDisposition; reminderWindowDays?: number }>,
  path: string,
): void {
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    throw new Error(`${path}.thresholds must be a non-empty array`)
  }

  for (const threshold of thresholds) {
    if (!Number.isInteger(threshold.days) || threshold.days < 0) {
      throw new Error(`${path}.thresholds.days must use non-negative integers`)
    }
    assertDisposition(threshold.disposition)
    assertOptionalPositiveInteger(threshold.reminderWindowDays, `${path}.reminderWindowDays`)
  }
}

function validateActiveDaysLast30d(
  heuristic: ChurnPretriageConfig["defaults"]["customerHeuristics"]["activeDaysLast30d"],
): void {
  if (!isRecord(heuristic)) {
    throw new Error("activeDaysLast30d must be an object")
  }

  assertBoolean(heuristic.enabled, "activeDaysLast30d.enabled")
  assertNonNegativeInteger(
    heuristic.minimumCustomerAgeDays,
    "activeDaysLast30d.minimumCustomerAgeDays",
  )
  validateActiveDayThresholds(heuristic.thresholds)
}

function validateActiveDayThresholds(
  thresholds: Array<{
    maxDays: number
    disposition: ChurnDisposition
    reminderWindowDays?: number
  }>,
): void {
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    throw new Error("active day thresholds must be a non-empty array")
  }

  for (const threshold of thresholds) {
    if (!Number.isInteger(threshold.maxDays) || threshold.maxDays < 0) {
      throw new Error("active day thresholds must use non-negative integers")
    }
    assertDisposition(threshold.disposition)
    assertOptionalPositiveInteger(
      threshold.reminderWindowDays,
      "activeDaysLast30d.reminderWindowDays",
    )
  }
}

function validateDropVsBaseline(
  heuristic: ChurnPretriageConfig["defaults"]["customerHeuristics"]["dropVsBaseline"],
): void {
  if (!isRecord(heuristic)) {
    throw new Error("dropVsBaseline must be an object")
  }

  assertBoolean(heuristic.enabled, "dropVsBaseline.enabled")
  assertPositiveInteger(heuristic.windowDays, "dropVsBaseline.windowDays")
  assertPositiveInteger(heuristic.baselineDays, "dropVsBaseline.baselineDays")
  assertNonNegativeInteger(
    heuristic.minimumBaselineActiveDays,
    "dropVsBaseline.minimumBaselineActiveDays",
  )
  assertNonNegativeInteger(
    heuristic.minimumBaselineEventCount,
    "dropVsBaseline.minimumBaselineEventCount",
  )
  if (heuristic.dropPercent < 0 || heuristic.dropPercent > 1) {
    throw new Error("dropVsBaseline.dropPercent must be between 0 and 1")
  }
  assertDisposition(heuristic.disposition)
  assertOptionalPositiveInteger(heuristic.reminderWindowDays, "dropVsBaseline.reminderWindowDays")
}

function validateUserDaysSinceLastMeaningfulActivity(
  heuristic: ChurnPretriageConfig["defaults"]["userHeuristics"]["daysSinceLastMeaningfulActivity"],
): void {
  validateThresholdHeuristic(heuristic, "userHeuristics.daysSinceLastMeaningfulActivity")
  assertOptionalNonNegativeInteger(
    heuristic.minimumPriorActiveDays,
    "userHeuristics.daysSinceLastMeaningfulActivity.minimumPriorActiveDays",
  )
}

function validateAllRecentlyActiveUsersNowInactive(
  heuristic: ChurnPretriageConfig["defaults"]["userHeuristics"]["allRecentlyActiveUsersNowInactive"],
): void {
  if (!isRecord(heuristic)) {
    throw new Error("allRecentlyActiveUsersNowInactive must be an object")
  }

  assertBoolean(heuristic.enabled, "allRecentlyActiveUsersNowInactive.enabled")
  assertPositiveInteger(heuristic.lookbackDays, "allRecentlyActiveUsersNowInactive.lookbackDays")
  assertPositiveInteger(heuristic.inactiveDays, "allRecentlyActiveUsersNowInactive.inactiveDays")
  if (heuristic.inactiveDays >= heuristic.lookbackDays) {
    throw new Error("allRecentlyActiveUsersNowInactive.inactiveDays must be less than lookbackDays")
  }
  assertPositiveInteger(
    heuristic.minimumPreviouslyActiveUsers,
    "allRecentlyActiveUsersNowInactive.minimumPreviouslyActiveUsers",
  )
  assertNonNegativeInteger(
    heuristic.minimumPriorActiveDays,
    "allRecentlyActiveUsersNowInactive.minimumPriorActiveDays",
  )
  assertDisposition(heuristic.disposition)
  assertOptionalPositiveInteger(
    heuristic.reminderWindowDays,
    "allRecentlyActiveUsersNowInactive.reminderWindowDays",
  )
}

function validatePromptSelection(promptSelection: ChurnPretriageConfig["promptSelection"]): void {
  if (promptSelection === undefined) {
    return
  }

  if (!isRecord(promptSelection)) {
    throw new Error("promptSelection must be an object")
  }

  const { rotationWindowHours } = promptSelection
  if (
    rotationWindowHours !== undefined &&
    (typeof rotationWindowHours !== "number" ||
      !Number.isFinite(rotationWindowHours) ||
      rotationWindowHours <= 0 ||
      rotationWindowHours > 24)
  ) {
    throw new Error("promptSelection.rotationWindowHours must be greater than 0 and at most 24")
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`)
  }

  for (const item of value) {
    if (typeof item !== "string" || item.length > 500) {
      throw new Error(`${path} must contain strings shorter than 500 characters`)
    }
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`)
  }
}

function assertPositiveInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer`)
  }
}

function assertOptionalPositiveInteger(
  value: unknown,
  path: string,
): asserts value is number | undefined {
  if (value === undefined) {
    return
  }

  assertPositiveInteger(value, path)
}

function assertOptionalNonNegativeInteger(
  value: unknown,
  path: string,
): asserts value is number | undefined {
  if (value === undefined) {
    return
  }

  assertNonNegativeInteger(value, path)
}

function assertBillingStatus(value: unknown, path: string): asserts value is ChurnBillingStatus {
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

function assertDisposition(value: unknown): asserts value is ChurnDisposition {
  if (value !== "investigate" && value !== "likely_churn") {
    throw new Error("churn pretriage disposition must be investigate or likely_churn")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function resolveScope(
  config: ChurnPretriageConfig,
  scopeProfile: ChurnScopeProfile,
  now: Date,
): ChurnScope {
  if (scopeProfile === "configured") {
    return config.defaults.scope
  }

  if (scopeProfile === "auto") {
    return config.scopeProfiles[resolveAutoScopeProfile(config, now)]
  }

  return config.scopeProfiles[scopeProfile]
}

function resolveAutoScopeProfile(
  config: ChurnPretriageConfig,
  now: Date,
): "all_accounts" | "revenue_accounts" {
  const intervalHours = config.autoScopeSchedule.intervalHours
  if (!Number.isInteger(intervalHours) || intervalHours <= 0 || 24 % intervalHours !== 0) {
    throw new Error("autoScopeSchedule.intervalHours must be a positive divisor of 24")
  }

  const scopeOrder = config.autoScopeSchedule.scopeOrder
  if (!Array.isArray(scopeOrder) || scopeOrder.length === 0) {
    throw new Error("autoScopeSchedule.scopeOrder must be a non-empty array")
  }

  const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes()
  const slotWithinDay = Math.floor(minutesSinceMidnight / (intervalHours * 60))
  const slotsPerDay = 24 / intervalHours
  const dayIndex = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / (24 * 60 * 60 * 1000),
  )
  const slotIndex = dayIndex * slotsPerDay + slotWithinDay
  const scopeProfile = scopeOrder[slotIndex % scopeOrder.length]

  if (scopeProfile !== "all_accounts" && scopeProfile !== "revenue_accounts") {
    throw new Error("autoScopeSchedule.scopeOrder contains an unsupported scope")
  }

  return scopeProfile
}

async function loadHeuristicData(params: {
  client: QueryClient
  config: ResolvedChurnPretriageConfig
}): Promise<{
  customerDirectory: Map<string, CustomerDirectoryRow>
  customerActivityRows: CustomerActivityRow[]
  customerDropRows: CustomerDropRow[]
  userDirectory: Map<string, UserDirectoryRow>
  userActivityRows: UserActivityRow[]
  usersNowInactiveRows: UserInactivityRow[]
}> {
  const sqlParts = buildSqlParts(params.config)
  const [
    customerDirectoryRows,
    customerActivityRows,
    customerDropRows,
    userDirectoryRows,
    userActivityRows,
    usersNowInactiveRows,
  ] = await Promise.all([
    queryRows<CustomerDirectoryRow>(params.client, buildCustomerDirectorySql(sqlParts)),
    queryRows<CustomerActivityRow>(params.client, buildCustomerActivitySql(sqlParts)),
    queryRows<CustomerDropRow>(
      params.client,
      buildCustomerDropVsBaselineSql(sqlParts, params.config),
    ),
    queryRows<UserDirectoryRow>(params.client, buildUserDirectorySql(sqlParts)),
    queryRows<UserActivityRow>(params.client, buildUserActivitySql(sqlParts)),
    queryRows<UserInactivityRow>(
      params.client,
      buildUsersRecentlyActiveNowInactiveSql(sqlParts, params.config),
    ),
  ])

  return {
    customerDirectory: new Map(customerDirectoryRows.map((row) => [row.customerId, row])),
    customerActivityRows: customerActivityRows.map(normalizeCustomerActivityRow),
    customerDropRows: customerDropRows.map(normalizeCustomerDropRow),
    userDirectory: new Map(
      userDirectoryRows.map((row) => [`${row.customerId}:${row.userId}`, row]),
    ),
    userActivityRows: userActivityRows.map(normalizeUserActivityRow),
    usersNowInactiveRows: usersNowInactiveRows.map(normalizeUserInactivityRow),
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
  activityFilter: string
  customerScopeFilter: string
  activityScopeFilter: string
  userScopeFilter: string
}

function buildSqlParts(config: ResolvedChurnPretriageConfig): SqlParts {
  const scopeFilter = buildScopeFilter(config.scope)

  return {
    activityFilter: buildMeaningfulActivityFilter(config.activityDefinition),
    customerScopeFilter: scopeFilter.customers,
    activityScopeFilter: scopeFilter.activity,
    userScopeFilter: scopeFilter.users,
  }
}

function buildScopeFilter(scope: ChurnScope): {
  customers: string
  activity: string
  users: string
} {
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

function buildMeaningfulActivityFilter(
  activityDefinition: ResolvedChurnPretriageConfig["activityDefinition"],
): string {
  const normalizedEventName = "lower(trim(event_name))"
  const includeEventNames = normalizeEventNames(activityDefinition.includeEventNames)
  if (includeEventNames.length > 0) {
    return `${normalizedEventName} IN (${toSqlStringList(includeEventNames)})`
  }

  const excludeEventNames = normalizeEventNames(activityDefinition.excludeEventNames)
  if (excludeEventNames.length > 0) {
    return `${normalizedEventName} NOT IN (${toSqlStringList(excludeEventNames)})`
  }

  return "1 = 1"
}

function buildCustomerDirectorySql(sqlParts: SqlParts): string {
  return `
    SELECT
      customer_id AS customerId,
      any(name) AS customerName,
      any(domain) AS domain,
      any(billing_status) AS billingStatus,
      any(mrr_cents) AS mrrCents
    FROM customers
    WHERE customer_id != ''
      AND ${sqlParts.customerScopeFilter}
    GROUP BY customer_id
    ORDER BY mrrCents DESC
    LIMIT 10000
  `
}

function buildCustomerActivitySql(sqlParts: SqlParts): string {
  return `
    SELECT
      customer_id AS customerId,
      min(occurred_at) AS firstMeaningfulActivityAt,
      max(occurred_at) AS lastMeaningfulActivityAt,
      countDistinctIf(toDate(occurred_at), occurred_at >= now() - INTERVAL 30 DAY) AS activeDays30d,
      countIf(occurred_at >= now() - INTERVAL 30 DAY) AS eventCount30d
    FROM activity
    WHERE occurred_at >= now() - INTERVAL ${ACTIVITY_LOOKBACK_DAYS} DAY
      AND customer_id != ''
      AND ${sqlParts.activityScopeFilter}
      AND ${sqlParts.activityFilter}
    GROUP BY customer_id
    LIMIT 10000
  `
}

function buildCustomerDropVsBaselineSql(
  sqlParts: SqlParts,
  config: ResolvedChurnPretriageConfig,
): string {
  const heuristic = config.customerHeuristics.dropVsBaseline
  const baselineAndWindowDays = heuristic.windowDays + heuristic.baselineDays

  return `
    SELECT
      customer_id AS customerId,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= now() - INTERVAL ${heuristic.windowDays} DAY
      ) AS currentActiveDays,
      countIf(occurred_at >= now() - INTERVAL ${heuristic.windowDays} DAY) AS currentEventCount,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= now() - INTERVAL ${baselineAndWindowDays} DAY
          AND occurred_at < now() - INTERVAL ${heuristic.windowDays} DAY
      ) AS baselineActiveDays,
      countIf(
        occurred_at >= now() - INTERVAL ${baselineAndWindowDays} DAY
          AND occurred_at < now() - INTERVAL ${heuristic.windowDays} DAY
      ) AS baselineEventCount
    FROM activity
    WHERE occurred_at >= now() - INTERVAL ${baselineAndWindowDays} DAY
      AND customer_id != ''
      AND ${sqlParts.activityScopeFilter}
      AND ${sqlParts.activityFilter}
    GROUP BY customer_id
    LIMIT 10000
  `
}

function buildUserDirectorySql(sqlParts: SqlParts): string {
  return `
    SELECT
      customer_id AS customerId,
      user_id AS userId,
      any(email) AS email,
      any(name) AS name
    FROM users
    WHERE customer_id != ''
      AND user_id != ''
      AND ${sqlParts.userScopeFilter}
    GROUP BY customer_id, user_id
    LIMIT 10000
  `
}

function buildUserActivitySql(sqlParts: SqlParts): string {
  return `
    SELECT
      customer_id AS customerId,
      user_id AS userId,
      max(occurred_at) AS lastMeaningfulActivityAt,
      countDistinct(toDate(occurred_at)) AS activeDaysObserved
    FROM activity
    WHERE occurred_at >= now() - INTERVAL ${ACTIVITY_LOOKBACK_DAYS} DAY
      AND customer_id != ''
      AND user_id != ''
      AND ${sqlParts.activityScopeFilter}
      AND ${sqlParts.activityFilter}
    GROUP BY customer_id, user_id
    LIMIT 10000
  `
}

function buildUsersRecentlyActiveNowInactiveSql(
  sqlParts: SqlParts,
  config: ResolvedChurnPretriageConfig,
): string {
  const heuristic = config.userHeuristics.allRecentlyActiveUsersNowInactive

  return `
    SELECT
      customer_id AS customerId,
      user_id AS userId,
      maxIf(
        occurred_at,
        occurred_at >= now() - INTERVAL ${heuristic.lookbackDays} DAY
          AND occurred_at < now() - INTERVAL ${heuristic.inactiveDays} DAY
      ) AS lastActivityBeforeInactiveWindow,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= now() - INTERVAL ${heuristic.lookbackDays} DAY
          AND occurred_at < now() - INTERVAL ${heuristic.inactiveDays} DAY
      ) AS priorActiveDays,
      countIf(
        occurred_at >= now() - INTERVAL ${heuristic.lookbackDays} DAY
          AND occurred_at < now() - INTERVAL ${heuristic.inactiveDays} DAY
      ) AS priorEventCount,
      countIf(occurred_at >= now() - INTERVAL ${heuristic.inactiveDays} DAY) AS recentEventCount
    FROM activity
    WHERE occurred_at >= now() - INTERVAL ${heuristic.lookbackDays} DAY
      AND customer_id != ''
      AND user_id != ''
      AND ${sqlParts.activityScopeFilter}
      AND ${sqlParts.activityFilter}
    GROUP BY customer_id, user_id
    LIMIT 10000
  `
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

function normalizeCustomerActivityRow(row: CustomerActivityRow): CustomerActivityRow {
  return {
    ...row,
    activeDays30d: Number(row.activeDays30d),
    eventCount30d: Number(row.eventCount30d),
  }
}

function normalizeCustomerDropRow(row: CustomerDropRow): CustomerDropRow {
  return {
    ...row,
    currentActiveDays: Number(row.currentActiveDays),
    currentEventCount: Number(row.currentEventCount),
    baselineActiveDays: Number(row.baselineActiveDays),
    baselineEventCount: Number(row.baselineEventCount),
  }
}

function normalizeUserActivityRow(row: UserActivityRow): UserActivityRow {
  return {
    ...row,
    activeDaysObserved: Number(row.activeDaysObserved),
  }
}

function normalizeUserInactivityRow(row: UserInactivityRow): UserInactivityRow {
  return {
    ...row,
    priorActiveDays: Number(row.priorActiveDays),
    priorEventCount: Number(row.priorEventCount),
    recentEventCount: Number(row.recentEventCount),
  }
}

function createCustomerAccumulator(
  customerDirectory: Map<string, CustomerDirectoryRow>,
): CustomerAccumulator {
  const customersById = new Map<string, InternalPretriageCustomer>()

  const ensureCustomer = (customerId: string): InternalPretriageCustomer => {
    const existing = customersById.get(customerId)
    if (existing) return existing

    const directoryCustomer = customerDirectory.get(customerId)
    const customer: InternalPretriageCustomer = {
      customerId,
      customerName: directoryCustomer?.customerName ?? null,
      domain: directoryCustomer?.domain ?? null,
      billingStatus: directoryCustomer?.billingStatus ?? null,
      mrrCents: directoryCustomer?.mrrCents ?? null,
      disposition: "investigate",
      customerHeuristics: [],
      userHeuristics: [],
      activityBaseline: null,
      fingerprint: "",
      internalMatches: [],
    }
    customersById.set(customerId, customer)
    return customer
  }

  return { customersById, ensureCustomer }
}

function attachCustomerActivityBaselines(params: {
  customerActivityRows: CustomerActivityRow[]
  ensureCustomer: CustomerAccumulator["ensureCustomer"]
}): void {
  for (const row of params.customerActivityRows) {
    const customer = params.ensureCustomer(row.customerId)
    customer.activityBaseline = {
      firstMeaningfulActivityAt: row.firstMeaningfulActivityAt,
      lastMeaningfulActivityAt: row.lastMeaningfulActivityAt,
      meaningfulActiveDays30d: row.activeDays30d,
      meaningfulEventCount30d: row.eventCount30d,
    }
  }
}

function applyCustomerHeuristics(params: {
  now: Date
  resolvedConfig: ResolvedChurnPretriageConfig
  customerDirectory: Map<string, CustomerDirectoryRow>
  customerActivityRows: CustomerActivityRow[]
  customerDropRows: CustomerDropRow[]
  ensureCustomer: CustomerAccumulator["ensureCustomer"]
}): void {
  const { now, resolvedConfig, customerDirectory, customerActivityRows, customerDropRows } = params

  if (resolvedConfig.customerHeuristics.pastDueBillingStatus.enabled) {
    for (const row of customerDirectory.values()) {
      if (row.billingStatus !== "PAST_DUE") continue

      const match: HeuristicMatch = {
        level: "customer",
        key: "pastDueBillingStatus",
        stateKey: buildStateKey("customer", "pastDueBillingStatus", "past_due"),
        rank: 1,
        disposition: resolvedConfig.customerHeuristics.pastDueBillingStatus.disposition,
        reminderWindowDays:
          resolvedConfig.customerHeuristics.pastDueBillingStatus.reminderWindowDays,
      }

      addCustomerHeuristicMatch({
        customer: params.ensureCustomer(row.customerId),
        match,
        summary: {
          key: "pastDueBillingStatus",
          disposition: match.disposition,
          summary: "Customer billing status is PAST_DUE",
          reminderWindowDays: match.reminderWindowDays,
        },
      })
    }
  }

  if (resolvedConfig.customerHeuristics.daysSinceLastMeaningfulActivity.enabled) {
    for (const row of customerActivityRows) {
      const daysSince = daysBetween(parseDate(row.lastMeaningfulActivityAt), now)
      const match = pickDaysThresholdMatch(
        "customer",
        "daysSinceLastMeaningfulActivity",
        daysSince,
        resolvedConfig.customerHeuristics.daysSinceLastMeaningfulActivity.thresholds,
      )
      if (!match) continue

      addCustomerHeuristicMatch({
        customer: params.ensureCustomer(row.customerId),
        match,
        summary: {
          key: "daysSinceLastMeaningfulActivity",
          disposition: match.disposition,
          value: daysSince,
          summary: `${daysSince} days since last meaningful activity`,
          reminderWindowDays: match.reminderWindowDays,
        },
      })
    }
  }

  if (resolvedConfig.customerHeuristics.activeDaysLast30d.enabled) {
    for (const row of customerActivityRows) {
      if (
        daysBetween(parseDate(row.firstMeaningfulActivityAt), now) <
        resolvedConfig.customerHeuristics.activeDaysLast30d.minimumCustomerAgeDays
      ) {
        continue
      }

      const match = pickActiveDaysThresholdMatch(
        row.activeDays30d,
        resolvedConfig.customerHeuristics.activeDaysLast30d.thresholds,
      )
      if (!match) continue

      addCustomerHeuristicMatch({
        customer: params.ensureCustomer(row.customerId),
        match,
        summary: {
          key: "activeDaysLast30d",
          disposition: match.disposition,
          value: row.activeDays30d,
          summary: `${row.activeDays30d} meaningful active days in the last 30 days`,
          reminderWindowDays: match.reminderWindowDays,
        },
      })
    }
  }

  if (resolvedConfig.customerHeuristics.dropVsBaseline.enabled) {
    for (const row of customerDropRows) {
      const heuristic = resolvedConfig.customerHeuristics.dropVsBaseline
      const expectedActiveDays =
        (row.baselineActiveDays / heuristic.baselineDays) * heuristic.windowDays
      const activeDayDrop =
        expectedActiveDays > 0
          ? (expectedActiveDays - row.currentActiveDays) / expectedActiveDays
          : 0

      if (row.baselineActiveDays < heuristic.minimumBaselineActiveDays) continue
      if (row.baselineEventCount < heuristic.minimumBaselineEventCount) continue
      if (activeDayDrop < heuristic.dropPercent) continue

      const match: HeuristicMatch = {
        level: "customer",
        key: "dropVsBaseline",
        stateKey: buildStateKey("customer", "dropVsBaseline", "drop"),
        rank: 1,
        disposition: heuristic.disposition,
        reminderWindowDays: heuristic.reminderWindowDays,
      }

      addCustomerHeuristicMatch({
        customer: params.ensureCustomer(row.customerId),
        match,
        summary: {
          key: "dropVsBaseline",
          disposition: match.disposition,
          value: row.currentActiveDays,
          previousValue: Number(expectedActiveDays.toFixed(2)),
          summary: `${Math.round(activeDayDrop * 100)}% drop in active days vs baseline`,
          reminderWindowDays: match.reminderWindowDays,
        },
      })
    }
  }
}

function applyUserHeuristics(params: {
  now: Date
  resolvedConfig: ResolvedChurnPretriageConfig
  userDirectory: Map<string, UserDirectoryRow>
  userActivityRows: UserActivityRow[]
  usersNowInactiveRows: UserInactivityRow[]
  ensureCustomer: CustomerAccumulator["ensureCustomer"]
}): void {
  applyStaleUserHeuristic(params)
  applyAllRecentlyActiveUsersNowInactiveHeuristic(params)
}

function applyStaleUserHeuristic(params: {
  now: Date
  resolvedConfig: ResolvedChurnPretriageConfig
  userDirectory: Map<string, UserDirectoryRow>
  userActivityRows: UserActivityRow[]
  ensureCustomer: CustomerAccumulator["ensureCustomer"]
}): void {
  const config = params.resolvedConfig.userHeuristics.daysSinceLastMeaningfulActivity
  if (!config.enabled) return

  const groupedUserHeuristics = new Map<
    string,
    { match: HeuristicMatch; matchedUsers: OutlitChurnMatchedUser[] }
  >()

  for (const row of params.userActivityRows) {
    if (config.minimumPriorActiveDays && row.activeDaysObserved < config.minimumPriorActiveDays) {
      continue
    }

    const daysSince = daysBetween(parseDate(row.lastMeaningfulActivityAt), params.now)
    const match = pickDaysThresholdMatch(
      "user",
      "daysSinceLastMeaningfulActivity",
      daysSince,
      config.thresholds,
    )
    if (!match) continue

    const grouped = groupedUserHeuristics.get(row.customerId)
    const directoryUser = params.userDirectory.get(`${row.customerId}:${row.userId}`)
    const matchedUser: OutlitChurnMatchedUser = {
      userId: row.userId,
      email: directoryUser?.email ?? null,
      name: directoryUser?.name ?? null,
      daysSinceLastMeaningfulActivity: daysSince,
    }

    if (!grouped || match.rank > grouped.match.rank) {
      groupedUserHeuristics.set(row.customerId, { match, matchedUsers: [matchedUser] })
      continue
    }

    if (match.rank === grouped.match.rank) {
      grouped.matchedUsers.push(matchedUser)
    }
  }

  for (const [customerId, grouped] of groupedUserHeuristics.entries()) {
    addUserHeuristicMatch({
      customer: params.ensureCustomer(customerId),
      match: grouped.match,
      summary: {
        key: "daysSinceLastMeaningfulActivity",
        disposition: grouped.match.disposition,
        summary: `${grouped.matchedUsers.length} users crossed inactivity thresholds`,
        matchedUsers: grouped.matchedUsers.sort(
          (left, right) =>
            (right.daysSinceLastMeaningfulActivity ?? 0) -
            (left.daysSinceLastMeaningfulActivity ?? 0),
        ),
      },
    })
  }
}

function applyAllRecentlyActiveUsersNowInactiveHeuristic(params: {
  now: Date
  resolvedConfig: ResolvedChurnPretriageConfig
  userDirectory: Map<string, UserDirectoryRow>
  usersNowInactiveRows: UserInactivityRow[]
  ensureCustomer: CustomerAccumulator["ensureCustomer"]
}): void {
  const config = params.resolvedConfig.userHeuristics.allRecentlyActiveUsersNowInactive
  if (!config.enabled) return

  const inactiveQualifiedUsersByCustomer = new Map<string, OutlitChurnMatchedUser[]>()
  const qualifiedRecentlyActiveUserCounts = new Map<string, number>()
  const currentlyActiveUserCounts = new Map<string, number>()

  for (const row of params.usersNowInactiveRows) {
    if (row.recentEventCount > 0) {
      currentlyActiveUserCounts.set(
        row.customerId,
        (currentlyActiveUserCounts.get(row.customerId) ?? 0) + 1,
      )
    }

    if (row.priorEventCount <= 0) continue
    if (row.priorActiveDays < config.minimumPriorActiveDays) continue

    qualifiedRecentlyActiveUserCounts.set(
      row.customerId,
      (qualifiedRecentlyActiveUserCounts.get(row.customerId) ?? 0) + 1,
    )
    if (row.recentEventCount > 0) continue

    const directoryUser = params.userDirectory.get(`${row.customerId}:${row.userId}`)
    const matchedUsers = inactiveQualifiedUsersByCustomer.get(row.customerId) ?? []
    matchedUsers.push({
      userId: row.userId,
      email: directoryUser?.email ?? null,
      name: directoryUser?.name ?? null,
      daysSinceLastMeaningfulActivity: daysBetween(
        parseDate(row.lastActivityBeforeInactiveWindow),
        params.now,
      ),
    })
    inactiveQualifiedUsersByCustomer.set(row.customerId, matchedUsers)
  }

  for (const [customerId, matchedUsers] of inactiveQualifiedUsersByCustomer.entries()) {
    const qualifiedRecentlyActiveUsers = qualifiedRecentlyActiveUserCounts.get(customerId) ?? 0
    const currentlyActiveUsers = currentlyActiveUserCounts.get(customerId) ?? 0

    if (qualifiedRecentlyActiveUsers < config.minimumPreviouslyActiveUsers) continue
    if (currentlyActiveUsers > 0) continue
    if (matchedUsers.length !== qualifiedRecentlyActiveUsers) continue

    const match: HeuristicMatch = {
      level: "user",
      key: "allRecentlyActiveUsersNowInactive",
      stateKey: buildStateKey("user", "allRecentlyActiveUsersNowInactive", "inactive"),
      rank: 1,
      disposition: config.disposition,
      reminderWindowDays: config.reminderWindowDays,
    }

    addUserHeuristicMatch({
      customer: params.ensureCustomer(customerId),
      match,
      summary: {
        key: "allRecentlyActiveUsersNowInactive",
        disposition: match.disposition,
        summary: `${matchedUsers.length} previously active users are now inactive`,
        matchedUsers: matchedUsers.sort(
          (left, right) =>
            (right.daysSinceLastMeaningfulActivity ?? 0) -
            (left.daysSinceLastMeaningfulActivity ?? 0),
        ),
      },
    })
  }
}

function addCustomerHeuristicMatch(params: {
  customer: InternalPretriageCustomer
  match: HeuristicMatch
  summary: OutlitChurnCustomerHeuristic
}): void {
  params.customer.customerHeuristics.push(params.summary)
  params.customer.internalMatches.push(params.match)
  params.customer.disposition = getHigherDisposition(
    params.customer.disposition,
    params.match.disposition,
  )
}

function addUserHeuristicMatch(params: {
  customer: InternalPretriageCustomer
  match: HeuristicMatch
  summary: OutlitChurnUserHeuristic
}): void {
  params.customer.userHeuristics.push(params.summary)
  params.customer.internalMatches.push(params.match)
  params.customer.disposition = getHigherDisposition(
    params.customer.disposition,
    params.match.disposition,
  )
}

function finalizeSurfacedCustomers(
  customersById: Map<string, InternalPretriageCustomer>,
): OutlitChurnPretriageCustomer[] {
  const surfacedCustomers: OutlitChurnPretriageCustomer[] = []

  for (const customer of customersById.values()) {
    if (customer.internalMatches.length === 0) continue

    customer.fingerprint = buildFingerprint(customer.internalMatches.map((match) => match.stateKey))
    const { internalMatches: _internalMatches, ...publicCustomer } = customer
    surfacedCustomers.push(publicCustomer)
  }

  return surfacedCustomers.sort((left, right) => {
    const dispositionDelta = dispositionRank(right.disposition) - dispositionRank(left.disposition)
    if (dispositionDelta !== 0) return dispositionDelta

    const signalDelta =
      right.customerHeuristics.length +
      right.userHeuristics.length -
      (left.customerHeuristics.length + left.userHeuristics.length)
    if (signalDelta !== 0) return signalDelta

    const mrrDelta = (right.mrrCents ?? 0) - (left.mrrCents ?? 0)
    if (mrrDelta !== 0) return mrrDelta

    return left.customerId.localeCompare(right.customerId)
  })
}

function selectCustomersForPrompt(params: {
  customers: OutlitChurnPretriageCustomer[]
  maxPromptCustomers: number
  now: Date
  rotationWindowHours?: number
}): OutlitChurnPretriageCustomer[] {
  const { customers, maxPromptCustomers, now, rotationWindowHours } = params
  if (maxPromptCustomers <= 0 || customers.length <= maxPromptCustomers) {
    return customers
  }

  const likelyChurnCustomers = customers.filter(
    (customer) => customer.disposition === "likely_churn",
  )
  const investigateCustomers = customers.filter(
    (customer) => customer.disposition === "investigate",
  )
  const rotatedLikelyChurnCustomers = rotateCustomersForPrompt(
    likelyChurnCustomers,
    now,
    maxPromptCustomers,
    rotationWindowHours,
  )

  if (rotatedLikelyChurnCustomers.length >= maxPromptCustomers) {
    return rotatedLikelyChurnCustomers.slice(0, maxPromptCustomers)
  }

  const remainingSlots = maxPromptCustomers - rotatedLikelyChurnCustomers.length

  return [
    ...rotatedLikelyChurnCustomers,
    ...rotateCustomersForPrompt(investigateCustomers, now, remainingSlots, rotationWindowHours),
  ].slice(0, maxPromptCustomers)
}

function rotateCustomersForPrompt(
  customers: OutlitChurnPretriageCustomer[],
  now: Date,
  pageSize: number,
  rotationWindowHours: number | undefined,
): OutlitChurnPretriageCustomer[] {
  if (customers.length <= 1) {
    return customers
  }

  const rotationWindowMs =
    (rotationWindowHours ?? DEFAULT_PROMPT_ROTATION_WINDOW_HOURS) * 60 * 60 * 1000
  const slotIndex = Math.floor(now.getTime() / rotationWindowMs)
  return rotateCustomers(customers, (slotIndex * pageSize) % customers.length)
}

function rotateCustomers<T>(items: T[], offset: number): T[] {
  if (items.length <= 1) {
    return items
  }

  const normalizedOffset = ((offset % items.length) + items.length) % items.length
  if (normalizedOffset === 0) {
    return items
  }

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)]
}

function buildPretriageSummary(
  surfacedCustomers: OutlitChurnPretriageCustomer[],
  includedCustomers: OutlitChurnPretriageCustomer[],
): OutlitChurnPretriageResult["summary"] {
  return {
    totalSurfacedCustomers: surfacedCustomers.length,
    customersIncludedThisRun: includedCustomers.length,
    deferredCustomers: Math.max(surfacedCustomers.length - includedCustomers.length, 0),
    suppressedCustomers: 0,
    likelyChurnCustomers: includedCustomers.filter(
      (customer) => customer.disposition === "likely_churn",
    ).length,
    investigateCustomers: includedCustomers.filter(
      (customer) => customer.disposition === "investigate",
    ).length,
  }
}

function buildDeterministicPretriageContext(params: {
  generatedAt: Date
  summary: OutlitChurnPretriageResult["summary"]
  customers: OutlitChurnPretriageCustomer[]
}): string {
  if (params.summary.totalSurfacedCustomers === 0) {
    return `Deterministic churn pretriage ran at ${params.generatedAt.toISOString()}, but no customers met the configured usage, billing, or user-inactivity thresholds.

Candidate accounting:
- Reviewed 0 deterministic pretriage candidates.
- Ranked 0 customers from deterministic pretriage.
- Do not rank a customer from this pass unless the user explicitly asks for a broader scan and richer Outlit evidence supports it.

You may still use broader portfolio analysis if the user asks for a general churn scan.`
  }

  const payload = {
    summary: params.summary,
    customers: params.customers.map(toPromptPretriageCustomer),
  }

  return `DETERMINISTIC CHURN PRETRIAGE RESULTS:
- These customers were surfaced by deterministic usage, billing, and user-inactivity rules before the model review.
- The payload's activity metrics are hard behavior evidence from product event data, even when timeline/search/fact context is sparse.
- Treat these customers as the investigation set for this churn run. Do not add unrelated customers unless the user explicitly asks for a broader scan.
- Prioritize likely_churn customers before investigate customers.
- You may drop a listed customer only if richer Outlit evidence clearly contradicts the risk.
- Candidate accounting is required in the final answer: state how many pretriage candidates were reviewed, how many were ranked, and how many were excluded.
- Do not rank a customer unless you can cite at least one hard churn signal and one supporting evidence point from Outlit tools or the pretriage payload.
- Exclude customers whose recent meaningful activity recovered, whose evidence is only passive/noisy activity, or whose only support is stale qualitative context.
- Lower confidence, rather than excluding, when the hard activity metrics show paid non-use but timeline, search, facts, or relationship context are sparse.
- Do not expose the words "heuristic", "deterministic pretriage", "SQL", or internal event names in final customer-facing recommendations.
BEGIN_PRETRIAGE_JSON
${JSON.stringify(payload, null, 2)}
END_PRETRIAGE_JSON`
}

function toPromptPretriageCustomer(customer: OutlitChurnPretriageCustomer) {
  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    domain: customer.domain,
    billingStatus: customer.billingStatus,
    mrrCents: customer.mrrCents,
    disposition: customer.disposition,
    signals: [
      ...customer.customerHeuristics.map((signal) => ({
        scope: "customer" as const,
        disposition: signal.disposition,
        summary: signal.summary,
        value: signal.value,
        previousValue: signal.previousValue,
      })),
      ...customer.userHeuristics.map((signal) => ({
        scope: "user" as const,
        disposition: signal.disposition,
        summary: signal.summary,
        matchedUsers: signal.matchedUsers,
      })),
    ],
    activityBaseline: customer.activityBaseline,
  }
}

function pickDaysThresholdMatch(
  level: "customer" | "user",
  key: string,
  valueDays: number,
  thresholds: Array<{ days: number; disposition: ChurnDisposition; reminderWindowDays?: number }>,
): HeuristicMatch | null {
  let bestMatch: HeuristicMatch | null = null

  for (const [index, threshold] of [...thresholds].sort((a, b) => a.days - b.days).entries()) {
    if (valueDays < threshold.days) continue

    bestMatch = {
      level,
      key,
      stateKey: buildStateKey(level, key, `days>=${threshold.days}`),
      rank: index + 1,
      disposition: threshold.disposition,
      reminderWindowDays: threshold.reminderWindowDays,
    }
  }

  return bestMatch
}

function pickActiveDaysThresholdMatch(
  valueDays: number,
  thresholds: Array<{
    maxDays: number
    disposition: ChurnDisposition
    reminderWindowDays?: number
  }>,
): HeuristicMatch | null {
  const sortedThresholds = [...thresholds].sort((a, b) => a.maxDays - b.maxDays)

  for (const [index, threshold] of sortedThresholds.entries()) {
    if (valueDays > threshold.maxDays) continue

    return {
      level: "customer",
      key: "activeDaysLast30d",
      stateKey: buildStateKey("customer", "activeDaysLast30d", `activeDays<=${threshold.maxDays}`),
      rank: sortedThresholds.length - index,
      disposition: threshold.disposition,
      reminderWindowDays: threshold.reminderWindowDays,
    }
  }

  return null
}

function buildStateKey(level: "customer" | "user", key: string, bucket: string): string {
  return `${level}|${key}|${bucket}`
}

function buildFingerprint(stateKeys: string[]): string {
  return [...stateKeys].sort().join(",")
}

function getHigherDisposition(left: ChurnDisposition, right: ChurnDisposition): ChurnDisposition {
  return dispositionRank(left) >= dispositionRank(right) ? left : right
}

function dispositionRank(disposition: ChurnDisposition): number {
  return disposition === "likely_churn" ? 2 : 1
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

function parseDate(value: string): Date {
  const date = new Date(hasExplicitTimezone(value) ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date returned by Outlit query: ${value}`)
  }

  return date
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
}
