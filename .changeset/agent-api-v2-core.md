---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
---

Agent API v2, slice A: people, toolsets, folded customer sections, a schema tool, paged SQL, and a 64 KiB response cap.

**Removed and renamed tools.** The old names answer through the API until 2026-12-11 (each response says so in `outlit-deprecation`), but `@outlit/tools`, the CLI and Pi no longer offer them.

- `outlit_list_users` is `outlit_list_people`.
- `outlit_schema` is `outlit_get_schema`.
- `outlit_get_customer_relationship`, `outlit_get_customer_features` and `outlit_get_customer_credits` are gone: they are `outlit_get_customer` with `include: ["relationship"]`, `["features", "meters"]` and `["credits"]`. `customerIncludeSections` gains `relationship`, `features`, `meters` and `credits`.
- `outlit_list_crm_fields` was already `outlit_list_customer_fields` (Phase 1).
- New: `outlit_list_toolsets` and `outlit_load_toolset`. Every tool contract now carries its `toolset` (`core`, `work`, `identity`, `admin` or `meta`); a tool may also carry `sizeHint`, `seeAlso` and `aliases` (`[{ name, until }]`, its retired names with their last day).
- The payload enum `userListOrderFields` is now `personOrderFields` (`last_activity_at`, `first_synced_at`, `email`; `first_seen_at` is now `first_synced_at`). `schemaTables` gains `arr_history`.

**`outlit_list_people`** (was `outlit_list_users`).

- Inputs: `customerId` is `customer` (ID, domain or name); `journeyStage` is `filters.journeyStage`, an array of lowercase stages (`discovered`, `signed_up`, `activated`, `engaged`, `inactive`); `hasActivityInLast` and `noActivityInLast` are `filters.activity.within` and `notWithin`, in whole minutes, hours or days (`90m`, `12h`, `7d`; at most `3650d`); `traitFilters` is `filters.fields` (`{ field: { source: "traits", key }, op, value }`); `search` is `filters.search`; `filters.role` is new. `orderBy` takes `last_activity_at`, `first_synced_at` or `email`. `limit` is 25 by default and at most 100 (was up to 1000).
- Output: `pagination` is `page`. Each person has `customer: { id, name, domain }` in place of `customerId`, `customerName` and `customerDomain`; `title` in place of `jobTitle`; `role` (`champion`, `decision_maker` or `primary_contact`, or `null`) in place of `relationshipRole`; a lowercase `journeyStage`; `association` (`domain` or `crm`); `lastCommunication` (`{ occurredAt, kind }` of the latest conversation they took part in, never product use); and `outlit.firstSyncedAt`. `daysSinceActivity` is gone.
- With `customer` it also lists people at other customers who are CRM contacts of that customer's companies, and counts CRM contacts with no person in `crmContactsWithoutPerson`.
- The `users` section of `outlit_get_customer` is the same person shape without `customer` and `association`.

**`outlit_get_customer`.**

- New sections `relationship` (`{ summary, items[≤ 8] { category, statement, observedAt, sourceLabels, evidence: [{ factId }] }, updatedAt }`; read a fact with `outlit_get_fact`), `features` (product-event features), `meters` (Autumn metered quantities that are not credits) and `credits` (`{ items, page, complete }`). Each is a section like the others: `{ status: "available", asOf, data }`, or a status and reason.
- `features`, `meters` and `credits` come in pages. New inputs `features`, `meters` (`{ weeks, weekly, limit, cursor }`) and `credits` (`{ limit, cursor }`) set the window and page; `weeks` (1 to 53) and `weekly` replace `weeks` and `includeWeeklyUsage`. `limit` is 25 by default and at most 100.
- The old `outlit_get_customer_features` result's flat `features` array of `event` and `metered` items is now two sections: `features.data.items` are the event items and `meters.data.items` the metered ones. Its `events` and `sources` fields are gone; a section's `status` and `reason` say what is missing.
- Result types: `CustomerRelationshipResult`, `CustomerFeaturesResult` and `CustomerCreditsResult` are gone. `CustomerRelationshipSection`, `CustomerFeaturesSection`, `CustomerMetersSection` and `CustomerCreditsSection` are the sections, and `CustomerRelationship`, `CustomerFeature`, `CustomerMeter` and `CustomerCredit` are their data and items. `Person` and `PersonListResult` are new.

**`outlit_query` and `outlit_get_schema`.**

- `outlit_query`: `sql` may be 20,000 characters (was 10,000). `limit` is the rows per page, 100 by default and at most 1000 (was 1000 and 10000). `cursor` is new: the same `sql` with the previous `page.nextCursor` reads the next page of a result kept for an hour. The result is `{ columns: [{ name, type }], rows, page }` in place of `{ success, data, metadata }`, with `truncation` when the result was cut (`row_cap` past 10,000 rows, or `byte_cap`).
- `outlit_get_schema` takes `topic` (`views`, `view`, `event_types` or `examples`) and `view` in place of `table`. Columns carry `nullable`, `unit`, `currencyColumn`, `decimalsColumn`, `timeZone` and `values`, and each view states its `rowsAre`, `excludes`, `freshness`, `duplicates` and `coverage`. The `customers` view gains `arr_amount` and `arr_decimals` beside `arr_currency`; `arr_cents` is deprecated until 2026-12-11. The new `arr_history` view has one row per customer per UTC day of ARR.

**Toolsets.** `outlit_load_toolset` takes optional `tools` (at most 10 names of that toolset) and returns for each tool `{ name, title, summary, description?, inputSchema? }`: the definitions come only for the tools you name, otherwise a one-line summary of each.

**Times and cursors.** A customer's `lastActivityAt` and `outlit.firstSyncedAt` are ISO 8601 UTC datetimes, checked by the schema. A `truncation` on a list now carries `next.input.cursor`. Invalid cursors are refused as `INVALID_TOOL_INPUT` with a `next`.

**Other contract changes.** `outlit_list_customers` gains `filters.renewal` (`within`: `next_30d`, `next_60d`, `next_90d`, `next_180d` or `next_365d`; or `after` and `before` as `YYYY-MM-DD` UTC dates), the `orderBy` value `renewal_date` (`customerListOrderFields` has it), and `renewal: { date, source } | null` on each customer (`source` is `outlit`, `crm` or `billing`); `orderDirection` no longer has a schema default, because the default is `desc` except `asc` with `renewal_date`. `outlit_list_customers` and `outlit_list_customer_fields` return at most 100 items per page (`outlit_list_customers` `limit` was up to 1000 with a default of 50, now 25; `outlit_list_customer_fields` was up to 50 with a default of 20, now 25). A list that would not fit in 64 KiB returns the items that fit with a `truncation` field whose `next` names the call for the rest; any other result over the cap is a `413` `TOOL_RESULT_TOO_LARGE`. The error code `IDEMPOTENCY_CONFLICT` (`409`) joins `toolGatewayErrorCodes`.

**Client.** `createOutlitClient` takes an optional `onResponse` that receives, after each response, the gateway's `outlit-deprecation` (`{ tool, use, until, message }`), `Sunset`, `outlit-notice` (sentences about an old input spelling it changed) and `idempotent-replayed` headers as `{ tool, status, deprecation?, sunset?, notices, replayed }`. `ToolsetName`, `toolsetNames`, `getToolset` and `toolNamesInToolsets` are new.

**CLI.**

- `outlit people list` replaces `outlit users list`. Its flags: `--customer` (was `--customer-id`), `--journey-stage` (lowercase, comma-separated), `--role`, `--no-activity-in` and `--has-activity-in` (whole minutes, hours or days such as `90m`, `12h` or `30d`), `--trait`, `--search`, `--order-by` (`last_activity_at`, `first_synced_at`, `email`), `--limit` and `--cursor`. Table output adds title, customer and last contact.
- `customers get` takes `--include relationship,features,meters,credits` with `--weeks`, `--weekly`, `--limit` and `--cursor`. The `customers relationship`, `customers features` and `customers credits` commands now call `customers get` and print its result; their old output shapes are gone.
- `customers list` takes `--renews-in` (`next_30d` to `next_365d`), `--renews-after` and `--renews-before` (dates), sorts by `--order-by renewal_date`, and prints a Renews column. `--order-direction` is sent only when given.
- `sql` takes `--cursor`; `--limit` is 1 to 1000 (default 100, was 1 to 10000, default 1000), and the result is `{ columns, rows, page }`. `schema` takes a view name, `events` or `examples`.
- The gateway's deprecation and notices print to stderr. Root help groups the commands by toolset.
- Still accepted, no longer advertised: `users list`, `customers relationship|features|credits`, `--customer-id` and `--order-by first_seen_at`.

**Pi.**

- The default, analytical and full Pi tool sets follow the contract (`outlit_list_people`, `outlit_get_schema`, `outlit_list_toolsets`, `outlit_load_toolset`; the removed tools are gone).
- New `toolsets` option registers every tool in the toolsets you name, beside any `toolNames`.
- A tool result that comes with a deprecation or an input notice has it as a second text block after the JSON.
- The Pi skill describes the new sections, `outlit_list_people` and `outlit_get_schema`.
