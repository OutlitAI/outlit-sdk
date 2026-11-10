# SQL Reference

Use this when writing or debugging `outlit_query` queries.

Always inspect schema first with `outlit_get_schema` (`topic: "examples"` has worked queries).

## Views

- `activity`: product and communication activity
- `customers`: customer attributes, billing, revenue (`arr_amount` in minor units with `arr_currency` and `arr_decimals`; `arr_cents` and `mrr_cents` are deprecated)
- `users`: user attributes and journey stages
- `revenue`: ARR daily, one row per customer per UTC day since 2026-11-06 (`snapshot_date`, `arr_amount`, `arr_currency`, `arr_decimals`, `arr_estimated`, `revenue_lifecycle`, customer id, name, domain and status); a day with no row was not computed. It has no MRR columns

## Useful Patterns

```sql
now()
today()
toStartOfMonth(occurred_at)
dateDiff('day', first_seen_at, now())
occurred_at >= now() - INTERVAL 30 DAY
countIf(billing_status = 'PAYING')
sumIf(arr_amount, billing_status = 'PAYING' AND arr_currency = 'USD')
JSONExtractString(properties, 'path')
JSONExtractString(traits, 'plan')
```

Prefer `event_name` when you need the original tracked event name for include/exclude lists or product workflow analysis, and `event_type` for broader event classes.

Use the patterns above instead of unsupported date helpers like `DATE_SUB()`.

## Rules

- Only `SELECT` queries are allowed.
- Add time filters for event queries.
- Use `LIMIT`.
- Prefer specific columns over `SELECT *`.
- Divide `arr_amount` by `10^arr_decimals` for display, and group by `arr_currency`: amounts in different currencies never add.
- Count `activity` rows with `uniqExact(event_id)`, not `count()`.
- Pages hold at most `limit` rows (default 100, max 1000); send `page.nextCursor` with the same SQL for the next page.

## Use SQL When

- You need aggregates, cohorts, joins, or time-series analysis.
- You need cross-customer reporting.

Use customer tools instead for single-account lookups.
