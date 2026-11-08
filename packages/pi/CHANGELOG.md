# @outlit/pi

## 2.2.0

### Minor Changes

- [#288](https://github.com/OutlitAI/outlit-sdk/pull/288) [`3cf621a`](https://github.com/OutlitAI/outlit-sdk/commit/3cf621a675cf8c2078243cf05946dba95af54e49) Thanks [@leo-paz](https://github.com/leo-paz)! - Each account in `outlit_get_customer`'s `crm` section lists the contacts that system associates with it, whatever their email domain: up to 25, with name, email, title and `userId` (the customer's user with that contact, or `null`). More are counted in `omittedContactCount`.

  `outlit_list_customers` takes `crm` filters on CRM and support tool account fields and `crmFields`, which returns those fields' values on each customer. New `outlit_list_crm_fields` lists the fields, with picklist options, the values linked accounts hold, and how many hold one. It joins `defaultToolNames`, so `@outlit/pi` registers it by default.

### Patch Changes

- [#282](https://github.com/OutlitAI/outlit-sdk/pull/282) [`0addb1e`](https://github.com/OutlitAI/outlit-sdk/commit/0addb1ed4278733bc5b010f06f7c2fe1cb7a4c25) Thanks [@leo-paz](https://github.com/leo-paz)! - Every public tool now declares `idempotentHint` as `true` or `false`, so MCP clients and app stores that require all four hints get an explicit value. `outlit_update_customer_access` and `outlit_grant_customer_access` are now `destructiveHint: true`, since either can move an Editor to Viewer and remove edit rights. `outlit_assign_customer_owner` is `idempotentHint: false`, since every call restamps the assignment time.

- Updated dependencies [[`3cf621a`](https://github.com/OutlitAI/outlit-sdk/commit/3cf621a675cf8c2078243cf05946dba95af54e49), [`6277cf0`](https://github.com/OutlitAI/outlit-sdk/commit/6277cf07821740341d8a94d3043243bcae39c5a7), [`2c3092c`](https://github.com/OutlitAI/outlit-sdk/commit/2c3092cdc415f67bf15972ee74d31d07187a291b), [`255dd70`](https://github.com/OutlitAI/outlit-sdk/commit/255dd7076c31903c41dd34f20e957ca5855808ad), [`bc278e0`](https://github.com/OutlitAI/outlit-sdk/commit/bc278e0c616b2987ec29026553adab0f57a9e654), [`cea8bfd`](https://github.com/OutlitAI/outlit-sdk/commit/cea8bfd80a9839fb5276d68b2b6d9eb2bfd428d3), [`06a29b3`](https://github.com/OutlitAI/outlit-sdk/commit/06a29b30d4db860c29fb6c95770dc2dc91cfd47b), [`0addb1e`](https://github.com/OutlitAI/outlit-sdk/commit/0addb1ed4278733bc5b010f06f7c2fe1cb7a4c25)]:
  - @outlit/tools@2.5.0

## 2.1.12

### Patch Changes

- [#274](https://github.com/OutlitAI/outlit-sdk/pull/274) [`e5029e2`](https://github.com/OutlitAI/outlit-sdk/commit/e5029e2355b3cf9a22adc8fce4371240c0c30a36) Thanks [@leo-paz](https://github.com/leo-paz)! - Revenue is now ARR, the annualized revenue run rate the Outlit app shows. Breaking output change for `@outlit/tools` consumers: the legacy monthly `currentMrr` and `mrrCalculationStatus` fields are removed. `outlit_list_customers` items carry `arr: { amount, currency, estimated } | null`, and `outlit_get_customer` revenue carries `arr` with its `lifecycle` and the `parts` it is counted from (subscriptions, usage, invoiced in the last 12 months). `outlit_list_customers` takes `arrAbove`, `arrBelow` and `orderBy: "arr_cents"`; `mrrAbove`, `mrrBelow` and `mrr_cents` still work but are deprecated. `outlit_get_customer` can `include` `renewal`: the renewal date the customer page shows, with its source (`outlit`, `crm` or `billing`). `outlit_get_source` and `outlit_list_sources` read Stripe invoices with every line item through the new `INVOICE` source type (`outlit_get_source`, `outlit_list_sources` and the matching `outlit sources get` and `outlit sources list` also accept `STRIPE_INVOICE` as an alias; search and facts list do not). The SQL `customers` view gains `arr_cents`, `arr_currency`, `arr_estimated` and `revenue_lifecycle`; `mrr_cents` and `mrr_status` remain for about a month, deprecated.

  The CLI adds `outlit customers list --arr-above`, `--arr-below` and `--order-by arr_cents`, and the table's MRR column becomes ARR, shown with its currency. `--mrr-above`, `--mrr-below` and `mrr_cents` are still accepted but no longer advertised. The Pi SQL reference now uses `arr_cents`.

- Updated dependencies [[`e5029e2`](https://github.com/OutlitAI/outlit-sdk/commit/e5029e2355b3cf9a22adc8fce4371240c0c30a36), [`6a5e0eb`](https://github.com/OutlitAI/outlit-sdk/commit/6a5e0ebf84f7dc7d0717d22444084e5cce1753c5), [`99ce585`](https://github.com/OutlitAI/outlit-sdk/commit/99ce5858523f8f1dd73425fb95d2eaed09cef15a)]:
  - @outlit/tools@2.4.0

## 2.1.11

### Patch Changes

- [#272](https://github.com/OutlitAI/outlit-sdk/pull/272) [`f84fff5`](https://github.com/OutlitAI/outlit-sdk/commit/f84fff5c660c1b1ebe0ffe8053e845c1b7fdbe3e) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the Inbox read tools to the generated public tool contracts and the OpenAPI document: `outlit_list_inbox` lists one section of a person's Inbox (today, open, snoozed, done or pool) as tasks, each with its task `itemId`, what it asks, what it is part of, its customer and what it answers; `outlit_get_inbox_item` reads one task by that id with its source preview, prepared reply and covered tasks. Outlit turns them on per workspace.

- [#273](https://github.com/OutlitAI/outlit-sdk/pull/273) [`7e515aa`](https://github.com/OutlitAI/outlit-sdk/commit/7e515aade75e113d1bdeb6a8fc9a6c80cba25147) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the Inbox write tools to the generated public tool contracts and the OpenAPI document: `outlit_act_on_inbox_item` takes a person's own action on one Inbox task by `itemId` (done, won't do, wrong, reopen, snooze, unsnooze, take, put back, not covered) and returns an `undoToken`; `outlit_undo_inbox_action` reverses it with that token. Rows' `actions` stay empty for now. Outlit turns them on per workspace.

- [#267](https://github.com/OutlitAI/outlit-sdk/pull/267) [`0194ae3`](https://github.com/OutlitAI/outlit-sdk/commit/0194ae3760b15360d56c9ca906cbbd614cafab3f) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove the four scoped identity repair tools (`outlit_list_scoped_repairs`, `outlit_preview_scoped_repair`, `outlit_execute_scoped_repair`, `outlit_verify_scoped_repair`) from the generated public tool contracts and the OpenAPI document. Outlit no longer offers them to customers over MCP, the CLI, Pi or the API; scoped repairs stay available on the Identity page in the Outlit app.

- Updated dependencies [[`f84fff5`](https://github.com/OutlitAI/outlit-sdk/commit/f84fff5c660c1b1ebe0ffe8053e845c1b7fdbe3e), [`7e515aa`](https://github.com/OutlitAI/outlit-sdk/commit/7e515aade75e113d1bdeb6a8fc9a6c80cba25147), [`0194ae3`](https://github.com/OutlitAI/outlit-sdk/commit/0194ae3760b15360d56c9ca906cbbd614cafab3f)]:
  - @outlit/tools@2.3.0

## 2.1.10

### Patch Changes

- [#254](https://github.com/OutlitAI/outlit-sdk/pull/254) [`ea43a1f`](https://github.com/OutlitAI/outlit-sdk/commit/ea43a1f25ef17126b374c6abbe53073bc91d1135) Thanks [@leo-paz](https://github.com/leo-paz)! - Add personal Circleback and Pocket API-key integration setup contracts.

- Updated dependencies [[`ea43a1f`](https://github.com/OutlitAI/outlit-sdk/commit/ea43a1f25ef17126b374c6abbe53073bc91d1135)]:
  - @outlit/tools@2.2.6

## 2.1.9

### Patch Changes

- [#250](https://github.com/OutlitAI/outlit-sdk/pull/250) [`8f567e4`](https://github.com/OutlitAI/outlit-sdk/commit/8f567e4ca847e9757dd1c524707eace006d14c9b) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts so each user from `outlit_list_users` and `outlit_get_customer` (with `users`) can say where Outlit found them: an optional `sources` list of `{ system, kind, count, firstSeenAt, lastSeenAt }`. Records (a CRM or support-tool `contact`, a `product_user`, a Slack `chat_member`, a `billing_customer`) have a null `count`; conversations the person took part in (`call`, `meeting`, `email`, `support_ticket`, `slack_thread`) carry how many and when. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `sources` as unknown, not empty. The CLI docs show the field. Companion to OutlitAI/Core#2957.

- Updated dependencies [[`8f567e4`](https://github.com/OutlitAI/outlit-sdk/commit/8f567e4ca847e9757dd1c524707eace006d14c9b)]:
  - @outlit/tools@2.2.5

## 2.1.8

### Patch Changes

- [#245](https://github.com/OutlitAI/outlit-sdk/pull/245) [`24fdff7`](https://github.com/OutlitAI/outlit-sdk/commit/24fdff7b1af5e064cf2a304ff90ae2754c06ea4c) Thanks [@leo-paz](https://github.com/leo-paz)! - Sync the API key validation contract v2 from Core: `apiKeyContractHeader` and `apiKeyValidationSuccessSchemaV2` add `apiKey.expiresAt`, returned only when a client sends `Outlit-Api-Key-Contract: 2`. The CLI now asks for v2 when it validates a key, still accepts v1 responses, and warns on stderr (once per run) when the key expires within 14 days, suggesting `outlit login`.

- Updated dependencies [[`24fdff7`](https://github.com/OutlitAI/outlit-sdk/commit/24fdff7b1af5e064cf2a304ff90ae2754c06ea4c)]:
  - @outlit/tools@2.2.4

## 2.1.7

### Patch Changes

- [#238](https://github.com/OutlitAI/outlit-sdk/pull/238) [`080062f`](https://github.com/OutlitAI/outlit-sdk/commit/080062f673e4f62d0440a46aaf6b7c23edee5a7a) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose Core's four scoped identity repair tools and expanded customer merge impact contract through the generated SDK tool schemas and OpenAPI document, and release compatible CLI and Pi consumers.

- [#242](https://github.com/OutlitAI/outlit-sdk/pull/242) [`157af7e`](https://github.com/OutlitAI/outlit-sdk/commit/157af7eb2c27cfdc4513cb85767fe1945cd58080) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts so each `outlit_search_customer_context` result can name its customer: `source` and `fact` results carry an optional `customer` (`id`, `name`, `domain`), which is `null` when the result can't be attributed to exactly one customer the caller can read. A search across customers now says whose source or fact matched. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `customer` like `null`. The API reference and CLI docs show the field. Companion to OutlitAI/Core#2569.

- [#239](https://github.com/OutlitAI/outlit-sdk/pull/239) [`b49f582`](https://github.com/OutlitAI/outlit-sdk/commit/b49f582fcef19b13faf43c52f971d183f49b9e05) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts with the unit on money fields: `currentMrr` and `lifetimeRevenue` (list and get customer) and `accountImportance.arrCents` (attention) are in the billing provider's units for the currency they were billed in. For USD, EUR, GBP and CAD these are cents, so divide by 100; other currencies follow the provider's amount rules, so the descriptions don't assume a divisor for them. ARR is 12 × `currentMrr` in the same units. The CLI's `--mrr-above`/`--mrr-below` help and shell completions now say the threshold is in `currentMrr`'s units rather than cents, and the CLI and agent docs state the same units. Descriptions only; no field shapes change. Companion to OutlitAI/Core#2557.

- Updated dependencies [[`080062f`](https://github.com/OutlitAI/outlit-sdk/commit/080062f673e4f62d0440a46aaf6b7c23edee5a7a), [`157af7e`](https://github.com/OutlitAI/outlit-sdk/commit/157af7eb2c27cfdc4513cb85767fe1945cd58080), [`b49f582`](https://github.com/OutlitAI/outlit-sdk/commit/b49f582fcef19b13faf43c52f971d183f49b9e05)]:
  - @outlit/tools@2.2.3

## 2.1.6

### Patch Changes

- [#224](https://github.com/OutlitAI/outlit-sdk/pull/224) [`b7ce7ea`](https://github.com/OutlitAI/outlit-sdk/commit/b7ce7ea37c088f8cf2a7e96226a55eb3a5e57ae5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `rateBasis`, `paceSinceReset`, `periodStart` and `changeDays` to the customer credit summary contract; the forecast rate is now a trailing 28-day average (7-day floor) with since-reset pace as context only.

- [#223](https://github.com/OutlitAI/outlit-sdk/pull/223) [`f2c90ed`](https://github.com/OutlitAI/outlit-sdk/commit/f2c90ed50a7cfb54a9103bb4ed2f6379f0197b34) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `customerOwnership` (`{ defaultOwnerUserId: string | null }`) to the workspace settings read/write contracts.

- [#236](https://github.com/OutlitAI/outlit-sdk/pull/236) [`a24208d`](https://github.com/OutlitAI/outlit-sdk/commit/a24208da4280715c61168b95349fcef099f7d519) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the `outlit_submit_feedback` tool contract and a matching `outlit feedback` CLI command for authenticated product feedback intake (`body`, optional `area` and `context`). Feedback is product intake — it is rate limited under a dedicated quota, does not consume paid plan API-call quota, and does not open a support ticket or guarantee a reply.

- [#221](https://github.com/OutlitAI/outlit-sdk/pull/221) [`3f5ef44`](https://github.com/OutlitAI/outlit-sdk/commit/3f5ef44f72182595675b6057f66f2228f1c05ca5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add optional, nullable `jevEvidence` advisory evidence to the `outlit_list_identity_merge_suggestions` output contract.

- [#230](https://github.com/OutlitAI/outlit-sdk/pull/230) [`456d5b5`](https://github.com/OutlitAI/outlit-sdk/commit/456d5b56fbd369e873578026c7812b3d8120f09a) Thanks [@leo-paz](https://github.com/leo-paz)! - Update the `outlit_get_timeline` contract with the additive `unreadable`/`unreadableReason` output fields, present only when an event's underlying source record cannot be retrieved via `outlit_get_source` — models should not retry source lookups on those rows.

- [#226](https://github.com/OutlitAI/outlit-sdk/pull/226) [`14575fa`](https://github.com/OutlitAI/outlit-sdk/commit/14575fa0d2c762caf860e186b026161b929342c3) Thanks [@leo-paz](https://github.com/leo-paz)! - Update the `outlit_get_timeline` contract for compact-by-default reads: optional `includeMetadata` and `productDetail` ("none" | "material" | "raw") inputs, optional `product` weekly usage aggregate in the output, required `pagination.effectiveLimit`, and `metadata` now optional on timeline events. Companion to Core#2285.

- [#229](https://github.com/OutlitAI/outlit-sdk/pull/229) [`a1f01e5`](https://github.com/OutlitAI/outlit-sdk/commit/a1f01e55a974e8ffa60b97da6dbc4edd4247a20c) Thanks [@leo-paz](https://github.com/leo-paz)! - Update the `outlit_get_timeline` contract with the additive `productUnavailable` output field, present only when the weekly product usage aggregate cannot be computed; also clarifies that `productDetail:"material"` returns no product rows when the organization has no configured value features while the `product` aggregate still comes back.

- [#233](https://github.com/OutlitAI/outlit-sdk/pull/233) [`fe951fa`](https://github.com/OutlitAI/outlit-sdk/commit/fe951fa8249f97ab631c16e961e597bc114d7f11) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts with `annotations.readOnlyHint`/`annotations.destructiveHint` on every public tool. Read-only commands declare `readOnlyHint: true`; merge/archive/revoke-style commands declare `destructiveHint: true`. Companion to OutlitAI/Core#2341.

- Updated dependencies [[`b7ce7ea`](https://github.com/OutlitAI/outlit-sdk/commit/b7ce7ea37c088f8cf2a7e96226a55eb3a5e57ae5), [`f2c90ed`](https://github.com/OutlitAI/outlit-sdk/commit/f2c90ed50a7cfb54a9103bb4ed2f6379f0197b34), [`a24208d`](https://github.com/OutlitAI/outlit-sdk/commit/a24208da4280715c61168b95349fcef099f7d519), [`3f5ef44`](https://github.com/OutlitAI/outlit-sdk/commit/3f5ef44f72182595675b6057f66f2228f1c05ca5), [`456d5b5`](https://github.com/OutlitAI/outlit-sdk/commit/456d5b56fbd369e873578026c7812b3d8120f09a), [`14575fa`](https://github.com/OutlitAI/outlit-sdk/commit/14575fa0d2c762caf860e186b026161b929342c3), [`a1f01e5`](https://github.com/OutlitAI/outlit-sdk/commit/a1f01e55a974e8ffa60b97da6dbc4edd4247a20c), [`fe951fa`](https://github.com/OutlitAI/outlit-sdk/commit/fe951fa8249f97ab631c16e961e597bc114d7f11)]:
  - @outlit/tools@2.2.2

## 2.1.5

### Patch Changes

- [#217](https://github.com/OutlitAI/outlit-sdk/pull/217) [`848aa20`](https://github.com/OutlitAI/outlit-sdk/commit/848aa20f3db45423a06a351d8f2bb0cf01e2f006) Thanks [@leo-paz](https://github.com/leo-paz)! - Recognize Core's non-retryable `TOOL_RESOURCE_NOT_FOUND` response for missing or unavailable resources, preserving its structured error details for CLI and SDK callers.

- Updated dependencies [[`848aa20`](https://github.com/OutlitAI/outlit-sdk/commit/848aa20f3db45423a06a351d8f2bb0cf01e2f006)]:
  - @outlit/tools@2.2.1

## 2.1.4

### Patch Changes

- [#209](https://github.com/OutlitAI/outlit-sdk/pull/209) [`485f4f0`](https://github.com/OutlitAI/outlit-sdk/commit/485f4f0c8f686100ab64414733e56b8a2e267041) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the shared customer identity diagnostic, saved suggestion review, and exact customer merge contracts. Preserve merge safety annotations in generated contracts. Add CLI commands for identity reads, suggestion list/reject, merge preview or explicit execution, and operation status. Merging requires the matching Core deployment and an explicitly granted credential.

- Updated dependencies [[`13a605f`](https://github.com/OutlitAI/outlit-sdk/commit/13a605fdfd241e583635218276eb306ba493b894), [`cb26b4c`](https://github.com/OutlitAI/outlit-sdk/commit/cb26b4c221318005393c6ae2c76f232a17ee2d39), [`591f4fc`](https://github.com/OutlitAI/outlit-sdk/commit/591f4fc5df40858e9b5c0aeea94cd39549cf711a), [`3c7c0d0`](https://github.com/OutlitAI/outlit-sdk/commit/3c7c0d069fa491261f71ba4b6e1a961a33783b8b), [`485f4f0`](https://github.com/OutlitAI/outlit-sdk/commit/485f4f0c8f686100ab64414733e56b8a2e267041), [`1fd4bd2`](https://github.com/OutlitAI/outlit-sdk/commit/1fd4bd209560a8218cb91985a7c0d5895effd565)]:
  - @outlit/tools@2.2.0

## 2.1.3

### Patch Changes

- [#205](https://github.com/OutlitAI/outlit-sdk/pull/205) [`79dc13a`](https://github.com/OutlitAI/outlit-sdk/commit/79dc13a46751b4fd7a8b0c6c491b1069c536af8d) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose bounded exact-source content pages, occurrence-time fact filters, and typed oversized tool-result errors.

- Updated dependencies [[`79dc13a`](https://github.com/OutlitAI/outlit-sdk/commit/79dc13a46751b4fd7a8b0c6c491b1069c536af8d)]:
  - @outlit/tools@2.1.3

## 2.1.2

### Patch Changes

- [#201](https://github.com/OutlitAI/outlit-sdk/pull/201) [`d743465`](https://github.com/OutlitAI/outlit-sdk/commit/d743465964df644a340e3fde70778a54a32bbb72) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose contact departure, position change, and disengagement facts through the generated customer fact filters.

- [#203](https://github.com/OutlitAI/outlit-sdk/pull/203) [`3214815`](https://github.com/OutlitAI/outlit-sdk/commit/321481599c1ca61b5c198ae776055208ba824fdd) Thanks [@leo-paz](https://github.com/leo-paz)! - Document the public contact-transition fact filters in CLI help and the bundled Pi guidance.

- Updated dependencies [[`d743465`](https://github.com/OutlitAI/outlit-sdk/commit/d743465964df644a340e3fde70778a54a32bbb72), [`1de7d3f`](https://github.com/OutlitAI/outlit-sdk/commit/1de7d3fc1fdf6c56f09cfd7c8808f5d43270974d)]:
  - @outlit/tools@2.1.2

## 2.1.1

### Patch Changes

- [#199](https://github.com/OutlitAI/outlit-sdk/pull/199) [`b933cf1`](https://github.com/OutlitAI/outlit-sdk/commit/b933cf1c09e6fdc3ae37274dfea34551c18c5d90) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose customer contact relationship and professional profile fields in the generated people contracts.

- Updated dependencies [[`b933cf1`](https://github.com/OutlitAI/outlit-sdk/commit/b933cf1c09e6fdc3ae37274dfea34551c18c5d90)]:
  - @outlit/tools@2.1.1

## 2.1.0

### Minor Changes

- [#195](https://github.com/OutlitAI/outlit-sdk/pull/195) [`dbcbe4c`](https://github.com/OutlitAI/outlit-sdk/commit/dbcbe4c0f1661b1c599ba0f6cda1ca1b0a4eee50) Thanks [@leo-paz](https://github.com/leo-paz)! - Replace the public Behavior Metric and Value Feature surfaces with one canonical Feature lifecycle.
  Use `outlit features list|create|archive` and `outlit customers features`; the generated public tools
  are `outlit_list_features`, `outlit_create_feature`, `outlit_archive_feature`, and
  `outlit_get_customer_features`. Creating a Feature still atomically creates the supporting weekly
  event-count and active-days metrics inside Outlit.

### Patch Changes

- [#196](https://github.com/OutlitAI/outlit-sdk/pull/196) [`d37138d`](https://github.com/OutlitAI/outlit-sdk/commit/d37138d98fc1c1e868ae1f1a578ec0bbe0902d4f) Thanks [@leo-paz](https://github.com/leo-paz)! - Align CLI and Pi public examples with current generated contracts and policy exports.

- Updated dependencies [[`2ab7311`](https://github.com/OutlitAI/outlit-sdk/commit/2ab7311de9e1d9a432669395f61b17a29712d96a), [`dbcbe4c`](https://github.com/OutlitAI/outlit-sdk/commit/dbcbe4c0f1661b1c599ba0f6cda1ca1b0a4eee50), [`b25bbee`](https://github.com/OutlitAI/outlit-sdk/commit/b25bbee0010fb5f3de0f81951d22da7374b79009), [`0d3bfd6`](https://github.com/OutlitAI/outlit-sdk/commit/0d3bfd63de335b7b59d6523efbbde51f8d8f2061)]:
  - @outlit/tools@2.1.0

## 2.0.0

### Major Changes

- [#186](https://github.com/OutlitAI/outlit-sdk/pull/186) [`d5360f8`](https://github.com/OutlitAI/outlit-sdk/commit/d5360f8485252dfe4772876b1b44a9488b1f3d32) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove `integrations list`, `integrations capabilities`, and the generated
  `outlit_get_integration_sync_status` tool. `outlit integrations setup` and
  `outlit integrations status` are the supported CLI workflow. Add the generated
  `outlit_setup_integration` contract and a bounded preferred setup client with secret-safe interactive
  prompts, strict opt-in stdin configuration, safe browser handoffs, and old-Core compatibility.
  Status now returns only the five canonical configuration-readiness states, without browser-session,
  raw provider-state, sync, backfill, or action metadata.

### Minor Changes

- [#184](https://github.com/OutlitAI/outlit-sdk/pull/184) [`2ec7678`](https://github.com/OutlitAI/outlit-sdk/commit/2ec7678f93187e9287b3ed3216fe27ffc86c0540) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose Core's event-based Behavior Metric source/event discovery and creation capabilities through tools and CLI while explicitly excluding the full capability family from Pi.

### Patch Changes

- [#181](https://github.com/OutlitAI/outlit-sdk/pull/181) [`327eef1`](https://github.com/OutlitAI/outlit-sdk/commit/327eef1012d8fba8e76f22c0947fd484dc3d21fb) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose Core's customer owner and sharing tool contracts to SDK tool consumers. Republish the
  CLI and Pi wrappers with their compatible tool-runtime dependency.
- Updated dependencies [[`2ec7678`](https://github.com/OutlitAI/outlit-sdk/commit/2ec7678f93187e9287b3ed3216fe27ffc86c0540), [`222bba6`](https://github.com/OutlitAI/outlit-sdk/commit/222bba6c3ad50138a0e3a84013a322a7bfe2b35a), [`327eef1`](https://github.com/OutlitAI/outlit-sdk/commit/327eef1012d8fba8e76f22c0947fd484dc3d21fb), [`d5360f8`](https://github.com/OutlitAI/outlit-sdk/commit/d5360f8485252dfe4772876b1b44a9488b1f3d32)]:
  - @outlit/tools@2.0.0

## 1.0.0

### Major Changes

- [#176](https://github.com/OutlitAI/outlit-sdk/pull/176) [`65ae3ac`](https://github.com/OutlitAI/outlit-sdk/commit/65ae3aca590682d9de07ba0168cab49dbe06eb5c) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove retired generic agent, automation, signal, identity, and notification surfaces from the public tools, CLI, and Pi packages. Public tool contracts, toolset memberships, gateway transport, OpenAPI, and ingest transport now derive from Core's capability catalog. Tracking packages expose only Platform-accepted event types; stage and billing lifecycle APIs remain removed across TypeScript and Rust.

### Patch Changes

- [#177](https://github.com/OutlitAI/outlit-sdk/pull/177) [`2dd6b8e`](https://github.com/OutlitAI/outlit-sdk/commit/2dd6b8e33aac2c3658b760f4c76a884cc6e3dde2) Thanks [@leo-paz](https://github.com/leo-paz)! - Sync customer tool contracts with Core, including customer enrichment, aligned input bounds, and updated customer and source descriptions.

- Updated dependencies [[`2dd6b8e`](https://github.com/OutlitAI/outlit-sdk/commit/2dd6b8e33aac2c3658b760f4c76a884cc6e3dde2), [`65ae3ac`](https://github.com/OutlitAI/outlit-sdk/commit/65ae3aca590682d9de07ba0168cab49dbe06eb5c)]:
  - @outlit/tools@1.0.0

## 0.1.6

### Patch Changes

- [#170](https://github.com/OutlitAI/outlit-sdk/pull/170) [`c1bef1d`](https://github.com/OutlitAI/outlit-sdk/commit/c1bef1dbd918b32e0ca5f7076070c24c5c848be3) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose pagination fields for exact Slack source lookups.

- Updated dependencies [[`c1bef1d`](https://github.com/OutlitAI/outlit-sdk/commit/c1bef1dbd918b32e0ca5f7076070c24c5c848be3)]:
  - @outlit/tools@0.3.1

## 0.1.5

### Patch Changes

- [#139](https://github.com/OutlitAI/outlit-sdk/pull/139) [`664e93c`](https://github.com/OutlitAI/outlit-sdk/commit/664e93cd8e1851f0183602ca07643b72a500ba35) Thanks [@leo-paz](https://github.com/leo-paz)! - Update timeline tool contracts to use canonical event channel values.

- [#144](https://github.com/OutlitAI/outlit-sdk/pull/144) [`29ca464`](https://github.com/OutlitAI/outlit-sdk/commit/29ca4643c9c236a589eedfc348ca9fa031c2a966) Thanks [@leo-paz](https://github.com/leo-paz)! - Sync notification tool contracts with hosted churn agent destination IDs.

- [#150](https://github.com/OutlitAI/outlit-sdk/pull/150) [`51b862d`](https://github.com/OutlitAI/outlit-sdk/commit/51b862d32ca2142da980ecde74add7f0f575a82a) Thanks [@leo-paz](https://github.com/leo-paz)! - Improve published README and package metadata citation surfaces with canonical docs, OpenAPI, MCP, and agent discovery links.

- Updated dependencies [[`664e93c`](https://github.com/OutlitAI/outlit-sdk/commit/664e93cd8e1851f0183602ca07643b72a500ba35), [`fa7ba55`](https://github.com/OutlitAI/outlit-sdk/commit/fa7ba55868c73ed72b46ee7f320fab0423742d74), [`fe80b2f`](https://github.com/OutlitAI/outlit-sdk/commit/fe80b2f3532fbe9a8bf973f076134d5fca70917d), [`4ab015f`](https://github.com/OutlitAI/outlit-sdk/commit/4ab015f89e88aaf3dd2a618d86b5e4cc0cb0eafc), [`29ca464`](https://github.com/OutlitAI/outlit-sdk/commit/29ca4643c9c236a589eedfc348ca9fa031c2a966), [`51b862d`](https://github.com/OutlitAI/outlit-sdk/commit/51b862d32ca2142da980ecde74add7f0f575a82a), [`8693011`](https://github.com/OutlitAI/outlit-sdk/commit/8693011d63919b3ae7c6fa5bc1a3ea3b692b508e)]:
  - @outlit/tools@0.3.0

## 0.1.4

### Patch Changes

- [#125](https://github.com/OutlitAI/outlit-sdk/pull/125) [`c488098`](https://github.com/OutlitAI/outlit-sdk/commit/c488098520191ee75dbfa8c61325393a4dd5ffbc) Thanks [@leo-paz](https://github.com/leo-paz)! - Add deterministic source listing CLI support and updated customer tool contracts.

- [#112](https://github.com/OutlitAI/outlit-sdk/pull/112) [`1d59be9`](https://github.com/OutlitAI/outlit-sdk/commit/1d59be9bf44ae08fc28de8fad98fc2826e7e2d41) Thanks [@leo-paz](https://github.com/leo-paz)! - Improve Pi tool parameter compatibility and update the Outlit growth-agent examples with safer churn review, activation pretriage, default Slack notification guidance, and cleaner deterministic pretriage helpers.

- Updated dependencies [[`c488098`](https://github.com/OutlitAI/outlit-sdk/commit/c488098520191ee75dbfa8c61325393a4dd5ffbc)]:
  - @outlit/tools@0.2.1

## 0.1.3

### Patch Changes

- [#123](https://github.com/OutlitAI/outlit-sdk/pull/123) [`4e86cbb`](https://github.com/OutlitAI/outlit-sdk/commit/4e86cbb7af5f13e34654e132d7960f36bb3ffa7c) Thanks [@leo-paz](https://github.com/leo-paz)! - Add markdown notification bodies and explicit Slack destinations while keeping Slack as the default notifier.

- Updated dependencies [[`4e86cbb`](https://github.com/OutlitAI/outlit-sdk/commit/4e86cbb7af5f13e34654e132d7960f36bb3ffa7c)]:
  - @outlit/tools@0.2.0

## 0.1.2

### Patch Changes

- [#115](https://github.com/OutlitAI/outlit-sdk/pull/115) [`842bbe8`](https://github.com/OutlitAI/outlit-sdk/commit/842bbe852b511dcabb50e610bfd13e69f99d8092) Thanks [@leo-paz](https://github.com/leo-paz)! - Update SQL tool contracts, CLI help, and Pi SQL guidance to use the public analytics views.

- [#117](https://github.com/OutlitAI/outlit-sdk/pull/117) [`dad1680`](https://github.com/OutlitAI/outlit-sdk/commit/dad168054587355d64ab50fec133cec005957627) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove backend-specific SQL wording from public analytics view guidance.

- Updated dependencies [[`d0dff81`](https://github.com/OutlitAI/outlit-sdk/commit/d0dff81fbc11c030b728ccf057601c8437e6215d), [`85eeca2`](https://github.com/OutlitAI/outlit-sdk/commit/85eeca2f5c4ae3155665852c9294bf89ddbd36fb), [`591dcaa`](https://github.com/OutlitAI/outlit-sdk/commit/591dcaa51cb8cee2d144de137f404b9a13cfd99a), [`842bbe8`](https://github.com/OutlitAI/outlit-sdk/commit/842bbe852b511dcabb50e610bfd13e69f99d8092), [`dad1680`](https://github.com/OutlitAI/outlit-sdk/commit/dad168054587355d64ab50fec133cec005957627)]:
  - @outlit/tools@0.1.2

## 0.1.1

### Patch Changes

- [#107](https://github.com/OutlitAI/outlit-sdk/pull/107) [`7a0811a`](https://github.com/OutlitAI/outlit-sdk/commit/7a0811a355c6a74b0222b2773bf3f6a54e3b903e) Thanks [@leo-paz](https://github.com/leo-paz)! - Export `actionToolNames` from `@outlit/pi` and keep the default Pi tool registration aligned with `outlit_send_notification`, so custom Pi agents can include notification actions explicitly while the default Pi toolset already includes them.

- [#109](https://github.com/OutlitAI/outlit-sdk/pull/109) [`4548ed5`](https://github.com/OutlitAI/outlit-sdk/commit/4548ed5df90e1f3e99a3172b093b93b10c2fa0b7) Thanks [@leo-paz](https://github.com/leo-paz)! - Add generic Pi toolset helpers and improve Outlit query schema guidance for agent use.

- Updated dependencies [[`7de9c83`](https://github.com/OutlitAI/outlit-sdk/commit/7de9c8358b0eb622c93487c1ddb6046446873c13), [`4548ed5`](https://github.com/OutlitAI/outlit-sdk/commit/4548ed5df90e1f3e99a3172b093b93b10c2fa0b7)]:
  - @outlit/tools@0.1.1

## 0.1.0

### Minor Changes

- [#100](https://github.com/OutlitAI/outlit-sdk/pull/100) [`46fe619`](https://github.com/OutlitAI/outlit-sdk/commit/46fe619b31795b930b39c32998d683da04c9ab10) Thanks [@leo-paz](https://github.com/leo-paz)! - Add a Pi package that registers Outlit customer intelligence tools through `@outlit/tools`.

- [#103](https://github.com/OutlitAI/outlit-sdk/pull/103) [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add public customer fact type and category filters, reject anomaly detector filters, and expand Pi growth-agent examples.

### Patch Changes

- Updated dependencies [[`e7f42ca`](https://github.com/OutlitAI/outlit-sdk/commit/e7f42ca89fe4e072f32e18969ae111ebd7979f59), [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5)]:
  - @outlit/tools@0.1.0
