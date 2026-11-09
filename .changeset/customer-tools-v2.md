---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
---

Customer tools move to the Agent API v2 shapes (`outlit_get_customer`, `outlit_list_customers`, `outlit_list_customer_fields`). Money, ARR, billing statuses, pagination and section results have one shape each.

**Tool rename.** `outlit_list_crm_fields` is now `outlit_list_customer_fields` (still the same command). It lists the fields Outlit holds about customers: CRM and support tool account fields and SDK traits. Its default-toolset and Pi entries change with it. Input `provider` is now `source` (which can also be `traits`). Output: `provider` is `source` inside `items[].field`, which is now `{ source, key }`; `observedValues` is `values`; `accounts` is `customers`; `pagination` is `page`; `items[].type`, `options` and `label` are unchanged; `coverage` is new on an empty list.

**Shared shapes.**

- Money is `{ amount, currency, decimals, formatted }` everywhere it appears (`amount` in minor units). ARR is `{ value: Money, estimated, lifecycle, parts?, basis? }`: the old `arr.amount` and `arr.currency` are now `arr.value.amount` and `arr.value.currency`, and `arr.parts.subscriptions`, `usage` and `invoicedLast12Months` are Money or `null` instead of numbers.
- Billing statuses are lowercase in inputs and outputs: `none`, `trialing`, `paying`, `past_due`, `churned` (were `NONE`, `TRIALING`, `PAYING`, `PAST_DUE`, `CHURNED`). `customerBillingStatuses` is lowercase.
- Lists return `page: { hasMore, nextCursor, total }` instead of `pagination`.
- A customer's `firstSeenAt` is `customer.outlit.firstSyncedAt` (and `outlit.firstSyncedAt` on list rows).
- Sort values are `last_activity_at`, `first_synced_at`, `name`, `arr` (were `last_activity_at`, `first_seen_at`, `name`, `arr_cents`, `mrr_cents`). `customerListOrderFields` changes with them.

**`outlit_get_customer`.**

- Every `include` result is a section: `{ status: "available", asOf, data }`, or `{ status: "empty" | "not_connected" | "not_synced" | "unavailable", reason, next? }`. The sections are `users`, `revenue`, `billing`, `recentTimeline`, `behaviorMetrics`, `enrichment`, `renewal`, `crm` and `links`; read `users.data`, `revenue.data` and so on (`renewal` was `{ date, source } | null`, `links` was `{ records, omitted }`). `crmSummary` stays top level.
- `revenue.data` is `{ arr, lifetimeRevenue: Money[], activeSubscriptions }`. `lifetimeRevenue` (a number) and `lifetimeRevenueCurrency` become the Money array.
- New include `billing` (and `customerIncludeSections` has it): `billing.data` is `{ accounts, subscriptions, overdueInvoices }`. `revenue.subscriptions`, `revenue.overdueInvoices` and `revenue.billingAccounts` moved there; `billingAccounts[]` is `accounts[]` with a `status` (`active` or `ended`) and `endedAt`. The `subscriptions: "live" | "all"` input now applies to `include billing`.
- Subscription items' `unitAmount` is Money or `null` and the item's `currency` is gone; overdue invoices' `amountRemaining` is Money or `null` and `currency` is gone.
- `enrichment.data` drops `status` and `error` (the section's own status says it) and gains `freshness` (`fresh`, `stale` or `input_changed`).

**`outlit_list_customers`.**

- Inputs move under `filters`: `billingStatus` is `filters.billingStatus` (an array of lowercase statuses), `arrAbove`/`arrBelow`/`arrCurrency` are `filters.arr.above`/`below`/`currency` (minor units), `traitFilters` and `crm` are `filters.fields` (`{ field: { source, key }, op, value }`, with `source: "traits"` for traits), `search` is `filters.search`, `ownerId`/`ownerEmail`/`hasOwner` are `filters.owner.id`/`email`/`has`, and `hasActivityInLast`/`noActivityInLast`/`activatedSince` are `filters.activity.within`/`notWithin`/`activatedSince`. `crmFields` is the top-level `fields` (`{ source, key }[]`). `mrrAbove` and `mrrBelow` are gone.
- Output: `pagination` is `page`; each row's `arr` is the ARR measure above, `firstSeenAt` is `outlit.firstSyncedAt`, and `crm` is `fields: [{ field: { source, key }, label, values }]`; `totals: { arr: Money[] }` is new (total ARR of every match, per currency).
- `limit` goes up to 1000 (was 100); the CLI still caps `--limit` at 100.

**CLI.** `customers list` keeps its flags and maps them to the new input; `customers get --subscriptions` now goes with `--include billing`. `--billing-status` takes lowercase statuses (comma-separate several); the old uppercase spelling, the old sort names `arr_cents`, `mrr_cents` and `first_seen_at`, and `--mrr-above`/`--mrr-below` are still accepted but no longer advertised. Table output prints `arr.value.formatted` (for example `$60,000.00`, `~` for an estimate) and the lowercase status. JSON output is the v2 result, with `page` in place of `pagination`.

**Pi and skills.** The default Pi toolset has `outlit_list_customer_fields` in place of `outlit_list_crm_fields`; the Pi skill describes sections and the new filters.
