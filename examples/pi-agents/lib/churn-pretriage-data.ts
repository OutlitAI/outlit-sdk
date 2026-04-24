import type { ChurnBillingStatus, ResolvedChurnPretriageConfig } from "./churn-pretriage.js"
import {
  buildBillingScopeFilter,
  normalizeEventNames,
  type QueryClient,
  queryRows,
  toSqlDateTime,
  toSqlStringList,
} from "./pretriage-utils.js"

const ACTIVITY_LOOKBACK_DAYS = 365

export type CustomerDirectoryRow = {
  customerId: string
  customerName: string | null
  domain: string | null
  billingStatus: ChurnBillingStatus | null
  mrrCents: number | null
}

export type CustomerActivityRow = {
  customerId: string
  firstMeaningfulActivityAt: string
  lastMeaningfulActivityAt: string
  activeDays30d: number
  eventCount30d: number
}

export type CustomerDropRow = {
  customerId: string
  currentActiveDays: number
  currentEventCount: number
  baselineActiveDays: number
  baselineEventCount: number
}

export type UserDirectoryRow = {
  customerId: string
  userId: string
  email: string | null
  name: string | null
}

export type UserActivityRow = {
  customerId: string
  userId: string
  lastMeaningfulActivityAt: string
  activeDaysObserved: number
}

export type UserInactivityRow = {
  customerId: string
  userId: string
  lastActivityBeforeInactiveWindow: string
  priorActiveDays: number
  priorEventCount: number
  recentEventCount: number
}

type SqlParts = {
  activityFilter: string
  customerScopeFilter: string
  activityScopeFilter: string
  userScopeFilter: string
}

export async function loadHeuristicData(params: {
  client: QueryClient
  config: ResolvedChurnPretriageConfig
  now: Date
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
    queryRows<CustomerActivityRow>(params.client, buildCustomerActivitySql(sqlParts, params.now)),
    queryRows<CustomerDropRow>(
      params.client,
      buildCustomerDropVsBaselineSql(sqlParts, params.config, params.now),
    ),
    queryRows<UserDirectoryRow>(params.client, buildUserDirectorySql(sqlParts)),
    queryRows<UserActivityRow>(params.client, buildUserActivitySql(sqlParts, params.now)),
    queryRows<UserInactivityRow>(
      params.client,
      buildUsersRecentlyActiveNowInactiveSql(sqlParts, params.config, params.now),
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

function buildSqlParts(config: ResolvedChurnPretriageConfig): SqlParts {
  const scopeFilter = buildBillingScopeFilter(config.scope)

  return {
    activityFilter: buildMeaningfulActivityFilter(config.activityDefinition),
    customerScopeFilter: scopeFilter.customers,
    activityScopeFilter: scopeFilter.activity,
    userScopeFilter: scopeFilter.users,
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

function buildCustomerActivitySql(sqlParts: SqlParts, now: Date): string {
  const sqlNow = toSqlDateTime(now)

  return `
    SELECT
      customer_id AS customerId,
      min(occurred_at) AS firstMeaningfulActivityAt,
      max(occurred_at) AS lastMeaningfulActivityAt,
      countDistinctIf(toDate(occurred_at), occurred_at >= ${sqlNow} - INTERVAL 30 DAY) AS activeDays30d,
      countIf(occurred_at >= ${sqlNow} - INTERVAL 30 DAY) AS eventCount30d
    FROM activity
    WHERE occurred_at >= ${sqlNow} - INTERVAL ${ACTIVITY_LOOKBACK_DAYS} DAY
      AND occurred_at <= ${sqlNow}
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
  now: Date,
): string {
  const heuristic = config.customerHeuristics.dropVsBaseline
  const baselineAndWindowDays = heuristic.windowDays + heuristic.baselineDays
  const sqlNow = toSqlDateTime(now)

  return `
    SELECT
      customer_id AS customerId,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= ${sqlNow} - INTERVAL ${heuristic.windowDays} DAY
      ) AS currentActiveDays,
      countIf(occurred_at >= ${sqlNow} - INTERVAL ${heuristic.windowDays} DAY) AS currentEventCount,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= ${sqlNow} - INTERVAL ${baselineAndWindowDays} DAY
          AND occurred_at < ${sqlNow} - INTERVAL ${heuristic.windowDays} DAY
      ) AS baselineActiveDays,
      countIf(
        occurred_at >= ${sqlNow} - INTERVAL ${baselineAndWindowDays} DAY
          AND occurred_at < ${sqlNow} - INTERVAL ${heuristic.windowDays} DAY
      ) AS baselineEventCount
    FROM activity
    WHERE occurred_at >= ${sqlNow} - INTERVAL ${baselineAndWindowDays} DAY
      AND occurred_at <= ${sqlNow}
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

function buildUserActivitySql(sqlParts: SqlParts, now: Date): string {
  const sqlNow = toSqlDateTime(now)

  return `
    SELECT
      customer_id AS customerId,
      user_id AS userId,
      max(occurred_at) AS lastMeaningfulActivityAt,
      countDistinct(toDate(occurred_at)) AS activeDaysObserved
    FROM activity
    WHERE occurred_at >= ${sqlNow} - INTERVAL ${ACTIVITY_LOOKBACK_DAYS} DAY
      AND occurred_at <= ${sqlNow}
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
  now: Date,
): string {
  const heuristic = config.userHeuristics.allRecentlyActiveUsersNowInactive
  const sqlNow = toSqlDateTime(now)

  return `
    SELECT
      customer_id AS customerId,
      user_id AS userId,
      maxIf(
        occurred_at,
        occurred_at >= ${sqlNow} - INTERVAL ${heuristic.lookbackDays} DAY
          AND occurred_at < ${sqlNow} - INTERVAL ${heuristic.inactiveDays} DAY
      ) AS lastActivityBeforeInactiveWindow,
      countDistinctIf(
        toDate(occurred_at),
        occurred_at >= ${sqlNow} - INTERVAL ${heuristic.lookbackDays} DAY
          AND occurred_at < ${sqlNow} - INTERVAL ${heuristic.inactiveDays} DAY
      ) AS priorActiveDays,
      countIf(
        occurred_at >= ${sqlNow} - INTERVAL ${heuristic.lookbackDays} DAY
          AND occurred_at < ${sqlNow} - INTERVAL ${heuristic.inactiveDays} DAY
      ) AS priorEventCount,
      countIf(occurred_at >= ${sqlNow} - INTERVAL ${heuristic.inactiveDays} DAY) AS recentEventCount
    FROM activity
    WHERE occurred_at >= ${sqlNow} - INTERVAL ${heuristic.lookbackDays} DAY
      AND occurred_at <= ${sqlNow}
      AND customer_id != ''
      AND user_id != ''
      AND ${sqlParts.activityScopeFilter}
      AND ${sqlParts.activityFilter}
    GROUP BY customer_id, user_id
    LIMIT 10000
  `
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
