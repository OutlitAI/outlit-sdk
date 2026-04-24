import type {
  ActivationBillingStatus,
  ResolvedActivationPretriageConfig,
} from "./activation-pretriage.js"
import {
  buildBillingScopeFilter,
  normalizeEventNames,
  type QueryClient,
  queryRows,
  toSqlDateTime,
  toSqlStringList,
} from "./pretriage-utils.js"

export type CustomerDirectoryRow = {
  customerId: string
  customerName: string | null
  domain: string | null
  billingStatus: ActivationBillingStatus | null
  mrrCents: number | null
}

export type UserActivationRow = {
  customerId: string
  usersObserved: number
  activatedUsers: number
  firstUserSeenAt: string | null
  lastUserActivityAt: string | null
}

export type EventActivationRow = {
  customerId: string
  firstProductEventAt: string | null
  lastProductEventAt: string | null
  recentEventCount: number
  recentActiveDays: number
  activationEventCount: number
}

type SqlParts = {
  customerScopeFilter: string
  activityScopeFilter: string
  userScopeFilter: string
}

export async function loadActivationData(params: {
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

function buildSqlParts(config: ResolvedActivationPretriageConfig): SqlParts {
  const scopeFilter = buildBillingScopeFilter(config.scope)

  return {
    customerScopeFilter: scopeFilter.customers,
    activityScopeFilter: scopeFilter.activity,
    userScopeFilter: scopeFilter.users,
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
    FROM customers
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
    FROM users
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
    FROM activity
    WHERE occurred_at <= ${sqlNow}
      AND customer_id != ''
      AND ${sqlParts.activityScopeFilter}
    GROUP BY customer_id
    LIMIT 10000
  `
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
