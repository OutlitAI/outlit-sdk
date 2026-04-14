# SQL Reference

Use this when writing or debugging `outlit_query` queries.

Always inspect schema first with `outlit_schema`.

## Tables

- `events`: product and communication activity
- `customer_dimensions`: customer attributes, billing, revenue
- `user_dimensions`: user attributes and journey stages
- `mrr_snapshots`: daily MRR snapshots

## ClickHouse Patterns

```sql
now()
today()
toStartOfMonth(occurred_at)
dateDiff('day', first_seen_at, now())
occurred_at >= now() - INTERVAL 30 DAY
countIf(billing_status = 'PAYING')
sumIf(mrr_cents, billing_status = 'PAYING')
JSONExtractString(properties, 'path')
```

Use ClickHouse syntax, not MySQL or Postgres helpers like `DATE_SUB()`.

## Rules

- Only `SELECT` queries are allowed.
- Add time filters for event queries.
- Use `LIMIT`.
- Prefer specific columns over `SELECT *`.
- Divide cents by `100` for display.

## Use SQL When

- You need aggregates, cohorts, joins, or time-series analysis.
- You need cross-customer reporting.

Use customer tools instead for single-account lookups.
