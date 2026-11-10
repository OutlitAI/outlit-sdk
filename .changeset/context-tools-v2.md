---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
---

The context tools move to the Agent API v2 shapes: `outlit_get_timeline`, `outlit_get_source`, `outlit_list_sources`, `outlit_search_customer_context`, `outlit_list_facts` and `outlit_get_fact`. This ships in the same release as the customer tools (`customer-tools-v2`), so there is one major bump. A source has one reference everywhere, enum values are lowercase, and lists page and report coverage one way.

**Shared shapes.**

- Source reference: `sourceType` + `sourceId`, `sourceRef { sourceType, sourceId }`, `linkedSourceRef` and `sourceMetadata` become `source { type, id }`. `type` is lowercase (`email`, `call`, `calendar_event`, `support_ticket`, `opportunity`, `slack`, `person_profile`, `invoice`, `crm_note`; `extracted` for a memory entry, in `outlit_get_source` only). Pass a `source` from any tool to `outlit_get_source` as it is.
- Source types: `CRM`, `CRM_OPPORTUNITY` (aliases of `OPPORTUNITY`) and `STRIPE_INVOICE` (alias of `INVOICE`) are now `opportunity` and `invoice`; `sourceTypes` (new export) lists the lowercase values.
- Pagination: `pagination { hasMore, nextCursor, effectiveLimit? }`, `contentPage.page { returned, ... }` and Slack `pageInfo` become `page { hasMore, nextCursor, total }` (`total` is `null` when unknown). `effectiveLimit` is gone.
- Customers: `customer` is `CustomerRef { id, name, domain }` everywhere, and `customer` input takes an ID, a domain or a name on every tool (up to 500 characters).
- Page size: `limit` on `outlit_get_timeline`, `outlit_list_sources` and `outlit_list_facts` defaults to 25 and caps at 100 (the timeline allowed 1000). The CLI sends 25 unless `--limit` is given.
- Empty lists keep `[]` and add `coverage { searched }`, which says what was searched.
- Sections: a result part that can be missing or empty is `{ status: "available", asOf, data }` or `{ status: "empty" | "not_connected" | "not_synced" | "unavailable", reason, next? }`, as on the customer tools.
- Enum values are lowercase in inputs and outputs: channels, event types, fact status, fact types and categories, source types.

**`outlit_get_timeline`.**

- Input `channels`, `eventTypes`, `timeframe` and `startDate`/`endDate` move under `filters`: `filters.channels` (lowercase, such as `product`), `filters.eventTypes` (lowercase, such as `note_added`), `filters.within` (was `timeframe`), `filters.after` (was `startDate`) and `filters.before` (was `endDate`). `within` and `before` can now be sent together (`within` counts back from `before`); `within` and `after` cannot. `productDetail`, `includeMetadata`, `limit` and `cursor` are unchanged.
- Output: `customer` is new (who the timeline is for). `events[].channel` and `events[].eventType` are lowercase (`communication`, `email_received`). `events[].sourceType`, `sourceId` and `sourceRef` are `events[].source { type, id }`, present when `outlit_get_source` can open it; `unreadable` and `unreadableReason` are `events[].unreadable { reason }` when it cannot. `occurredAtBasis` (`record` or `first_observed`) says what an event's `occurredAt` is. `pagination` is `page` (with `total`), and `effectiveLimit` is gone.
- `product { ... }` and `productUnavailable { reason }` become one section, `product: { status, asOf, data: { windowStartAt, windowEndAt, weeklyBuckets, topEventNames } }`; it is `empty` with a reason when no value features are configured.
- `timelineChannels` and `timelineTimeframes` keep their values; `toolTimelineChannels` (new) lists the lowercase channels, and `timelineOccurredAtBases` the event time bases.

**`outlit_get_source`.**

- Input `sourceType` + `sourceId` become `source { type, id }`. `limit` and `cursor` are unchanged.
- Output: `sourceType` + `sourceId` are `source { type, id }`; `customer` is `CustomerRef | null`. `contentPage { contentKind, segments, page, completeness }` is `content`, a section: `content.data { kind, segments, page, omittedFields }`. Content is partial while `content.data.page.hasMore` is true; `completeness` is gone.
- Invoice records: `record.amountDue`, `amountPaid` and `amountRemaining`, and each line's `amount` and `unitAmount`, are Money (`{ amount, currency, decimals, formatted }`) instead of minor-unit numbers, and `record.currency` is gone. Opportunity `record.amount` is Money, or `null` when no currency is known (it was a CRM number with an inferred currency). Slack `record.pageInfo` is `record.page`.

**`outlit_list_sources`.**

- Input `sourceType` (one) is `filters.sourceTypes` (any of). `after`, `before`, `participant`, `provider` and `hasTranscript` move under `filters`. `customer`, `limit` and `cursor` are unchanged.
- Output: `pagination` is `page`; each item's `sourceType` and `sourceId` are `source { type, id }`, its `customer` is `CustomerRef | null`, and its record fields use the Money shapes above. An empty list carries `coverage`.

**`outlit_search_customer_context`.**

- Input `topK` is `limit`; `sourceTypes`, `after` and `before` are `filters.sourceTypes`, `filters.after` and `filters.before`.
- Output: source results' `sourceType` and `sourceId` are `source { type, id }`, and `context.sourceRef` is `context.source`. An empty `results` carries `coverage`.

**`outlit_list_facts` and `outlit_get_fact`.**

- `outlit_list_facts` input: `status`, `sourceTypes`, `factTypes`, `factCategories`, `after` and `before` move under `filters` as `status`, `sourceTypes`, `types`, `categories`, `after` and `before`, all lowercase (`"ACTIVE"` is `"active"`, `"CHURN_RISK"` is `"churn_risk"`, `"MEMORY"` is `"memory"`). `customerFactStatuses`, `customerFactTypes` and `customerFactCategories` keep their uppercase values; `toolFactStatuses`, `toolFactTypes` and `toolFactCategories` (new) list the lowercase ones.
- Fact output: `factType` and `factCategory` are `type` and `category`, and `status` is lowercase. `linkedSourceRef` and `sourceMetadata` (`sourceType`, `sourceId`, `sourceOccurredAt`, `sourceQuote`, `permalink`) are `source { type, id, occurredAt, quote, permalink } | null`. `detectedAt`, `validFrom` and `lastDetectedAt` are `outlit { recordedAt, updatedAt }` (`validFrom` equals `recordedAt`). `evidence[].sourceType` and `sourceId` are `evidence[].source`. `pagination` is `page`, and an empty list carries `coverage`.
- Dropped (constant or null since facts moved to memory): `confidence`, `priority`, `severity`, `metricName`, `metricValue`, `metricPreviousValue`, `metricDelta`, `metricUnit`, `periodStart`, `periodEnd` and `changePointDate`.
- `outlit_get_fact` returns `{ customer, fact }` (it returned the fact). `include` is `["evidence"]` and is strict: an unknown value is refused (it was ignored).

**Old spellings.** The gateway maps the earlier inputs (top-level `topK`, `sourceTypes`, `after`, `before`, `sourceType`, `sourceId`, `startDate`, `endDate`, `timeframe`, `channels`, `eventTypes`, `status`, `factTypes`, `factCategories`), uppercase values and the source aliases to the new ones until 2026-12-11, and refuses them with the new name after that. Output fields are not mapped.

**CLI.** The commands keep their flags and map them to the new input. `outlit search` takes `--limit` in place of `--top-k`; `--top-k`, uppercase values (`--status ACTIVE`, `--fact-types CHURN_RISK`, `--channels COMMUNICATION`, `--source-type CALL`), the older channel names (`EMAIL`, `SLACK`, `CALL`, `CALENDAR`, `SDK`, `INTERNAL`) and the source aliases are still accepted but no longer advertised. `customers timeline --end-date` now works with `--timeframe` (the window counts back from the end date) instead of replacing it; `--start-date` still replaces it. `sources list --source-type` takes several types separated by commas, and `sources get --source-type` takes `extracted`. `facts get --include` refuses a value other than `evidence`. Table output (`sources list`) reads `source.type`, `source.id` and `page`, and prints what an empty list searched. JSON output is the v2 result.

**`@outlit/tools` helpers.** `resolveCustomerContextSearchInput` returns the v2 input (`limit` and `filters`) with lowercase source types and reads `limit` (or `topK`, the earlier name); `CustomerContextSearchInput` and `SearchArgsLike` change with it. New exports: `sourceTypes`, `ToolSourceType`, `toToolSourceType`, `toolTimelineChannels`, `timelineOccurredAtBases`, `toolFactStatuses`, `toolFactTypes` and `toolFactCategories`.

**Pi and skills.** The Pi skill and README describe the `filters` shapes, lowercase values, `source` references and `coverage`.
