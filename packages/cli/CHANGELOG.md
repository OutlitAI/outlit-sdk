# @outlit/cli

## 5.0.2

### Patch Changes

- [#314](https://github.com/OutlitAI/outlit-sdk/pull/314) [`aefebdd`](https://github.com/OutlitAI/outlit-sdk/commit/aefebdda78fb48e12ede80cfc6b62abff00cb3cd) Thanks [@leo-paz](https://github.com/leo-paz)! - The task tools (`outlit_list_tasks`, `outlit_act_on_task`) name the page they mirror as the Attention Inbox, its name in the app since Nov 6, instead of "To do". Words only; no schema change.

- [#310](https://github.com/OutlitAI/outlit-sdk/pull/310) [`1ccfbdc`](https://github.com/OutlitAI/outlit-sdk/commit/1ccfbdc52b1e75b70c08e76d111e65ead71d1fb5) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_create_destination` is `destructiveHint: true` again: with `isDefault: true` it replaces the workspace's current default destination. Clients that act on MCP annotations can use this to ask before running it, depending on their own policy.

- Updated dependencies [[`aefebdd`](https://github.com/OutlitAI/outlit-sdk/commit/aefebdda78fb48e12ede80cfc6b62abff00cb3cd), [`1ccfbdc`](https://github.com/OutlitAI/outlit-sdk/commit/1ccfbdc52b1e75b70c08e76d111e65ead71d1fb5)]:
  - @outlit/tools@4.0.1

## 5.0.1

### Patch Changes

- [#308](https://github.com/OutlitAI/outlit-sdk/pull/308) [`8f910fd`](https://github.com/OutlitAI/outlit-sdk/commit/8f910fd22af2c4dd4083cd6c69aa7b86e759bdfc) Thanks [@leo-paz](https://github.com/leo-paz)! - Non-ASCII text (the skill's emoji, ellipses, dashes, box drawing) printed garbled when the npm-installed CLI ran under Bun.

## 5.0.0

### Major Changes

- [#307](https://github.com/OutlitAI/outlit-sdk/pull/307) [`73e9f87`](https://github.com/OutlitAI/outlit-sdk/commit/73e9f8796984f2ca04226c8381ffab9d70dab7e2) Thanks [@leo-paz](https://github.com/leo-paz)! - Breaking: output shapes change, so these are major releases (`@outlit/cli` 5.0.0, `@outlit/tools` 4.0.0, `@outlit/pi` 4.0.0). A parser written for the earlier majors misreads: a fact's `evidence` is `{ items, page, more }` instead of an array; a fact from `outlit_list_facts` and `outlit_search_customer_context` has no `reasoning` or `source.quote` unless `include` asks (`outlit_get_fact` still returns both); enrichment funding totals are money objects (`fundingSummary.totalInvestment`, `fundingSummary.lastRoundAmount`), with the earlier `totalInvestmentUsd` and `lastRoundAmountUsd` kept beside them, deprecated, until 2026-12-12; `crmSummary` is an array of accounts instead of a map of label to value on list rows. `docs/api-reference/compatibility.mdx` lists each change and the minimum versions.

  The contracts are regenerated from Core for output version 2026-11-12: 26 output shapes change from 3.0.0 (`page.total` can be `null`, `lifetimeRevenue` can be `null`, `reasoning` and `source.quote` are optional, `evidence` is an object, `crmSummary` fields are `{ field, label, values }`). Writes take `idempotencyKey`; `requestId` is still accepted by the gateway until 2026-12-12. New tool `outlit_get_skill`; new error codes `CONFLICT`, `RATE_LIMITED` and `INTERNAL_ERROR` (`TOOL_IMPLEMENTATION_ERROR` is still accepted); a spent plan allowance is not retryable and carries `resetsAt`.

  `@outlit/tools` sends `Outlit-Version` when `createOutlitClient({ version })` is set, and exposes Core's `outlit-request-id` and `outlit-version` through `client.callToolWithMeta()` (`meta.requestId`, `meta.version`), `OutlitToolsApiError.requestId` and `.version`, and `onResponse`. `@outlit/cli` replaces `--request-id` with `--idempotency-key` (the old flag keeps working as a hidden alias that prints `Renamed: use ...` once), adds `--verbose` to print the request id and version, shows when a plan allowance resets, and takes `--idempotency-key` on `feedback submit`. `@outlit/pi` puts `requestId` and `version` in each result's `details`.

  Matches the Agent API v2 polish release of Core. Core switches its outputs on release; the old input spellings below keep working for 30 days, until 2026-12-12.

  The tool contracts are regenerated. Inputs: `outlit_get_fact` takes `id` (was `factId`) and `part`, which reads one long field a page at a time; `outlit_get_setup_session` takes `id` (was `sessionId`); `outlit_get_customer` takes `fields`, selectors `{ source?, key }` (was `crmFields`), and `crmContacts`; `outlit_list_people` `fields` are selectors; `outlit_list_facts` and `outlit_search_customer_context` take `include` (`reasoning`, `quote`, `evidence`); `outlit_list_customers` takes `filters.credits`, `orderBy: "meter_usage"` and `meter`. Outputs: facts have no `reasoning` or `source.quote` unless `include` asks, and `evidence` is `{ items, page, more }`; `crmSummary` is an array of accounts on list rows and `outlit_get_customer`; enrichment funding totals are money; sections that hold only their first part (`users`, `recentTimeline`) carry `more`; `recentTimeline` entries carry `id` and `source`; customer list rows carry `credits` and `meter`; `outlit_create_destination` refuses an existing active channel; toolsets carry `cost`. Validation issues carry `message`, a 429 carries `retryAfterSeconds`, and the grants `destinations:read`, `behavior_metrics:read` and `integrations:read` exist.

  `@outlit/tools` sends `x-outlit-client: <package>/<version>` on every request (`createOutlitClient` takes `client` for a package that wraps it), and keeps a 429's `retryAfterSeconds` on the error envelope. `@outlit/cli` and `@outlit/pi` send their own name and version, so Core can tell a client below a release's minimum version to upgrade.

  CLI: `facts get <id>` and `setup-sessions get <id>` send `id`. `facts get` takes `--part <field>` and `--cursor`; `facts list` and `search` take `--include reasoning,quote,evidence`; `customers get` takes `--fields <key,system:key>` and `--crm-contacts <connectionId>:<accountId>` (with `--cursor`); `customers list` takes `--runs-out-within`, `--meter` and `--meter-connection`, and shows Credits and Meter columns when the rows carry them. `--crm-fields` keeps working as `--fields` until 2026-12-12 and prints `Renamed: use …` once to stderr. At a terminal, an error shows each invalid field with what to fix, `Retry in Ns.` on a rate limit and the missing permission, and a result that holds only the first part of a section prints the command that reads the rest.

  `@outlit/tools` adds `collectionOf(toolName, output)`, which returns `{ key, items, page?, truncation? }` for any list tool whatever it names its rows (`items`, `facts`, `events`, `results`, `rows`), with `collectionKeys` and `isCollectionTool`. The CLI tables and its fact and customer list JSON use it.
  `@outlit/pi` returns a failed call (a gateway error, a rate limit, a dropped connection) as the tool result `{ error: { code, message, retryable, requestId, next, missingPermission, validationIssues, retryAfterSeconds, status } }`, with `details.error` holding the same object, instead of throwing, so the agent can fix its input, wait or report the missing permission. The default extension also registers `outlit_list_toolsets` and `outlit_load_toolset` (`piDefaultToolNames`), and the skill describes the fact depth correctly: a listed fact is concise, `include` adds `reasoning`, `quote` and the first three `evidence` excerpts, and `outlit_get_fact` `part` reads the rest. The CLI prints `Cut to fit the response size` with the command for the rest when the gateway cut a list.

### Minor Changes

- [#304](https://github.com/OutlitAI/outlit-sdk/pull/304) [`f0509f9`](https://github.com/OutlitAI/outlit-sdk/commit/f0509f9e0f761c18d638e555eb10bf57f9e3c420) Thanks [@leo-paz](https://github.com/leo-paz)! - The CLI now matches the Agent API v2: a tool `outlit_<verb>_<noun>` is `outlit <noun> <verb>`, flags are the tool's input names in kebab-case, and the required target is positional.

  New commands: `customer-fields list`, `tasks list|get|act|undo`, `setup-sessions get`, `timeline get`, `identity get`, `merge-suggestions list|reject`, `merges get`, `members list`, `query` and `schema get`, `feedback submit`, `integrations list`. `customers set-owner` and `customers set-access` (`--role none` removes access) replace `owner set`, `grant` and `revoke`, and take `--mode`, `--preview-token`, `--request-id` and `--undo-token`. `customers merge` takes `--mode preview|execute` and `--note`. `settings update` takes `--timezone`, `--default-owner`, `--activation-event` (`none` turns it off) and `--revision`, replacing `activation get|update|disable`. `destinations list --ids` and `destinations update --enabled true|false` replace `get`, `enable` and `disable`. `facts get <id>` and `sources get <type> <id>` take their target as arguments.

  Every previous spelling keeps working until 2026-12-11. It runs the new command and prints `Renamed: use `outlit …`` once to stderr. Help, shell completions and the docs show only the new names.

- [#306](https://github.com/OutlitAI/outlit-sdk/pull/306) [`cb7a3e5`](https://github.com/OutlitAI/outlit-sdk/commit/cb7a3e54f2d32627e1418a7a9492207eed541d76) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit --skill` prints the Outlit skill to stdout, so an agent gets the instructions from the CLI it already has. It needs no API key and no network, and it always matches the installed CLI version. The text is embedded at build time in both the npm package and the compiled binaries.

  `outlit setup skills`, `outlit setup <agent>` and `outlit onboard` now install a small stub skill that tells the agent to run `outlit --skill`, instead of copying the full text, so installed skills no longer go stale. Top-level help and the `outlit auth login` output mention `outlit --skill`.

### Patch Changes

- [#307](https://github.com/OutlitAI/outlit-sdk/pull/307) [`73e9f87`](https://github.com/OutlitAI/outlit-sdk/commit/73e9f8796984f2ca04226c8381ffab9d70dab7e2) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit search --limit` takes 1 to 100 with a default of 25, as the tool's contract says (help and validation said 1 to 50 and 20). The list commands that defaulted to 20 (`customers list`, `people list`, `members list`, `destinations list`, `features list`) now default to 25. The page sizes are read from the generated contracts.

- Updated dependencies [[`73e9f87`](https://github.com/OutlitAI/outlit-sdk/commit/73e9f8796984f2ca04226c8381ffab9d70dab7e2)]:
  - @outlit/tools@4.0.0

## 4.0.0

### Major Changes

- [#301](https://github.com/OutlitAI/outlit-sdk/pull/301) [`dc04f36`](https://github.com/OutlitAI/outlit-sdk/commit/dc04f369ba82111041564e06ababf3619e7d4a0b) Thanks [@leo-paz](https://github.com/leo-paz)! - The admin tools move to the Agent API v2 shapes: 25 tools become 16, with previews, undo and retry keys. This ships in the same release as the customer and context tools (`customer-tools-v2`, `context-tools-v2`), so there is one major bump. Each retired name and input spelling keeps answering through the gateway until 2026-12-11, then is refused with the new name; `@outlit/tools`, the CLI and Pi expose only the new names.

  **Tools.**

  - Destinations (7 to 4): `outlit_get_destination` is `outlit_list_destinations { ids: [id] }`. `outlit_enable_destination` and `outlit_disable_destination` are `outlit_update_destination { id, enabled }`. `outlit_create_destination`, `outlit_update_destination` and `outlit_archive_destination` stay.
  - Owner, access and members (5 to 3): `outlit_assign_customer_owner` is `outlit_set_customer_owner`. `outlit_grant_customer_access`, `outlit_update_customer_access` and `outlit_revoke_customer_access` are `outlit_set_customer_access { role: "viewer" | "editor" | "none" }`. `outlit_list_workspace_users` is `outlit_list_members`.
  - Integrations (5 and a compatibility list to 3): `outlit_get_integration_capabilities`, `outlit_get_integration_status` and the compatibility `outlit_list_integrations { connectedOnly }` are one `outlit_list_integrations`, with one entry per provider. `outlit_begin_integration_setup` is `outlit_setup_integration { handoff: true }`. `outlit_get_integration_setup_status` is `outlit_get_setup_session`. External API keys calling `outlit_list_integrations` get the new shape.
  - Settings and activation (6 to 3): `outlit_get_workspace_settings` and `outlit_get_customer_activation` are `outlit_get_settings`. `outlit_update_workspace_settings` and `outlit_update_customer_activation` are `outlit_update_settings`. `outlit_preview_customer_activation` is `outlit_preview_activation`.
  - Features: `outlit_list_features`, `outlit_create_feature` and `outlit_archive_feature` stay, on the v2 shapes.

  **Shared rules.**

  - Archives and the owner change preview first: `outlit_archive_destination`, `outlit_archive_feature` and `outlit_set_customer_owner` change nothing on the first call, and return `preview { token, expiresAt }`, what the change affects, and `next`. Confirm with `mode: "execute"` and `previewToken`. A v1 call `{ id }` is a preview, so an old script that archived in one call now archives nothing.
  - Undo: `outlit_set_customer_owner` and `outlit_set_customer_access` return `undo { token, until } | null`; call the same tool with `{ undoToken, requestId }`. A change the caller could not undo (removing their own access, or a former member's) returns `outcome: "needs_confirmation"` with the reason, a `preview` and `next`.
  - `requestId` is required on `outlit_create_destination`, `outlit_archive_destination`, `outlit_set_customer_owner`, `outlit_set_customer_access`, `outlit_setup_integration`, `outlit_create_feature` and `outlit_archive_feature`. A retry with the same id and input returns the first result.
  - `outlit_update_destination` and `outlit_update_settings` take the end state and an optional `revision`; a stale revision is refused with `stale_revision`, unless every field already holds its value.
  - Lists return `items` and `page { hasMore, nextCursor, total }`, 25 per page by default and at most 100, and `coverage` when empty. People are `MemberRef { id, name, email }` and customers `CustomerRef`. Enums are lowercase (`SLACK_CHANNEL` is `slack_channel`, `VIEWER` is `viewer`, `READY` is `ready`). A missing permission is `TOOL_CALL_FORBIDDEN` with `missingPermission`.
  - `customerId` and `targetUserId` become `customer` (an ID, a domain or an exact name) and `member` (a user ID or an email). Windows `{ startAt, endAt }` become `{ from, to }`.

  **Fields.**

  - `outlit_list_destinations`: `destinations` is `items`; `pagination` is `page`; `maskedConfig` is `config`; `syncStatus` and `lastSyncedAt` are `delivery { status, lastSyncedAt }`; each destination has a `revision`; `ids` and `filters { enabled, includeArchived }` are new, and ids that are not visible are listed in `missing`.
  - `outlit_create_destination`: `type: "SLACK_CHANNEL"` is `"slack_channel"`; the result is `{ created, destination }`, and `created: false` says the channel already was a destination and now has these settings.
  - `outlit_update_destination`: `type` is dropped; `revision`, `label`, `isDefault` (only `true`) and `enabled` are the fields; `isDefault: true` with `enabled: false` is invalid.
  - `outlit_set_customer_owner`: output `{ customerId, ownerId, previousOwnerId }` is `{ outcome, customer, owner, previousOwner, previousOwnerRole, undo }` (`outcome` is `previewed`, `changed`, `unchanged` or `undone`).
  - `outlit_set_customer_access`: output `{ access { customerId, userId, role, grantedById } }` is `{ outcome, customer, member, role, previousRole, undo }` (`outcome` is `changed`, `unchanged`, `undone` or `needs_confirmation`).
  - `outlit_list_members`: `search`, `role`, `managerEmail` and `hasOwnedCustomers` move under `filters`; `orderBy` is `owned_customers` or `name` (`owned_customer_count` is `owned_customers`; ordering by `email` is gone); `limit` is at most 100 (was 1000); `ownedCustomerCount` is `ownedCustomers`.
  - `outlit_list_integrations`: `providers[].authType` and `setupMode` are `items[].setup { auth, mode }`; `browserHandoffAvailable` and `preferredSetupVersion` are gone; `status` has the five agent states; `connection` is a section with `lastDataReceivedAt`, `syncStatus` and `hasSyncError`; the input `connectedOnly` is `filters.connected`.
  - `outlit_setup_integration`: the output `next` is `step`, so `next` always names the next call; `error { code: "OWNER_REQUIRED" }` is `problem { code: "owner_required", message, retryable, next? }` (codes are lowercase); CRM stage names are lowercase (`outlitStage: "won"`); `handoff: true` starts only the browser sign-in and refuses credentials and configuration.
  - `outlit_begin_integration_setup` output `{ state, sessionId, connectUrl, expiresAt }` is `step { kind: "browser_handoff", url, sessionId, expiresAt }`. `outlit_get_setup_session` returns `{ sessionId, provider, status, pollAfterSeconds?, next? }`.
  - `outlit_get_settings`: `{ settings { defaultTimezone, customerOwnership { defaultOwnerUserId } } }` and `{ activation { eventName } }` are `{ settings { general { timezone, defaultOwner }, activation { event } }, revision }`; each part is a section, and a part the caller cannot read says which permission it needs.
  - `outlit_update_settings`: `{ defaultTimezone, customerOwnership }` and `{ eventName }` are `{ revision?, timezone?, defaultOwner?, activationEvent? }`; the result is `{ settings, revision, changed }`.
  - `outlit_preview_activation`: `eventName` is `event`; `{ preview { ...Count } }` is `{ event, window { from, to }, evaluatedEvents, customers { matched, alreadyActivated, wouldActivate, truncated }, contacts { ..., occurrences }, examples }`, with `examples[].customer` a `CustomerRef`.
  - `outlit_list_features`: `sourceKey` moves to `filters.sourceKey`, and `filters.eventSearch` is new; `include: ["usage", "candidates"]` is new, and usage and candidates are read only when asked for; `candidateLimit` defaults to 25 (was 100); `features` is `items`; `evidence` is `usage` (a section, with `source_blocked`, `source_not_ready` or `query_failed` when unavailable); `selectedSourceKey` is `sources[].selected`; `workspaceActiveFeatureCount` is `workspaceActiveFeatures`; candidates are a section with `sourceKey`, `coverage` (`complete` or `partial`), `items` and `truncated`.
  - `outlit_create_feature` takes `requestId`. `outlit_archive_feature` previews first and returns `{ archived: false, preview, impact, next }` or `{ archived: true, feature }`.

  **`@outlit/tools`.** The exported result types follow the new tools: `Feature` is an item of `FeatureListResult["items"]`, and `FeatureRef` is the archived feature in `FeatureArchiveResult`.

  **`@outlit/cli`.** Every command and flag stays; the CLI maps them to the new tools and sends a fresh `requestId` with each write.

  - `destinations get <id>` reads `outlit_list_destinations { ids: [id] }` and prints `{ destination }`; an id Core does not show is `not_found`. `destinations list` takes `--limit` and `--cursor`. `destinations enable` and `disable` send `outlit_update_destination { id, enabled }`. `destinations update` no longer needs `--type` (a value is still checked).
  - `destinations archive`, `features archive` and `customers owner set` show Core's preview, then ask in a terminal. New `--yes` confirms without asking. Without a terminal and without `--yes` they print the preview, change nothing and exit 1 with `confirmation_required`; a script that relied on one-call archiving needs `--yes`. `customers grant` and `revoke` ask only when Core says the change could not be undone, with the same `--yes`.
  - `customers grant`, `revoke` and `owner set` take the customer as an ID, a domain or an exact name (no longer a UUID only) and the member as `--member` (a user ID or an email). `--target-user-id` is still read. `--role` is `viewer` or `editor` in any case; `revoke` sends role `none`.
  - `ws-users list` reads `outlit_list_members`. `--order-by` is `owned_customers` or `name`; `owned_customer_count` is still read, and `email` is refused. The default page stays 20 and the maximum is 100.
  - `activation get` prints the activation section of `outlit_get_settings` with the `revision`. `activation update` and `disable` send `outlit_update_settings { activationEvent }`. `activation preview` sends `outlit_preview_activation { event }`. `settings get` and `settings update --default-timezone` use `outlit_get_settings` and `outlit_update_settings { timezone }`.
  - `features list` still reads usage and candidates by default, and takes `--include` (`usage`, `candidates`), `--search`, `--limit` and `--cursor`; `--candidate-limit` defaults to 25. `features create` sends a `requestId`.
  - `integrations status` reads `outlit_list_integrations` (and `doctor` and `onboard` use it for readiness). `integrations setup` validates the provider locally, sends one `requestId` per setup call, reads `step` and `problem`, and polls `outlit_get_setup_session`. It no longer falls back to the older browser-handoff flow, so the error code `unsupported_core_version` is gone. Problem codes in JSON errors are lowercase (`credential_required`, `credential_rejected`).
  - `completions` lists the new flags.

  **`@outlit/pi`.** `piToolNames` carries the 16 admin tools in place of the 25.

- [#297](https://github.com/OutlitAI/outlit-sdk/pull/297) [`2930edd`](https://github.com/OutlitAI/outlit-sdk/commit/2930edd1a83cd20af335cde1f6a6b519428feadb) Thanks [@leo-paz](https://github.com/leo-paz)! - Agent API v2, slice A: people, toolsets, folded customer sections, a schema tool, paged SQL, and a 64 KiB response cap.

  **Removed and renamed tools.** The old names answer through the API until 2026-12-11 (each response says so in `outlit-deprecation`), but `@outlit/tools`, the CLI and Pi no longer offer them.

  - `outlit_list_users` is `outlit_list_people`.
  - `outlit_schema` is `outlit_get_schema`.
  - `outlit_get_customer_relationship`, `outlit_get_customer_features` and `outlit_get_customer_credits` are gone: they are `outlit_get_customer` with `include: ["relationship"]`, `["features", "meters"]` and `["credits"]`. `customerIncludeSections` gains `relationship`, `features`, `meters` and `credits`.
  - `outlit_list_crm_fields` was already `outlit_list_customer_fields` (Phase 1).
  - New: `outlit_list_toolsets` and `outlit_load_toolset`. Every tool contract now carries its `toolset` (`core`, `work`, `identity`, `admin` or `meta`); a tool may also carry `sizeHint`, `seeAlso` and `aliases` (`[{ name, until }]`, its retired names with their last day).
  - The payload enum `userListOrderFields` is now `personOrderFields` (`last_activity_at`, `first_synced_at`, `email`; `first_seen_at` is now `first_synced_at`).

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
  - `outlit_get_schema` takes `topic` (`views`, `view`, `event_types` or `examples`) and `view` in place of `table`. Columns carry `nullable`, `unit`, `currencyColumn`, `decimalsColumn`, `timeZone` and `values`, and each view states its `rowsAre`, `excludes`, `freshness`, `duplicates` and `coverage`. The `customers` view gains `arr_amount` and `arr_decimals` beside `arr_currency`; `arr_cents` is deprecated until 2026-12-11. **Breaking SQL change:** the `revenue` view's columns move from MRR to ARR. It is now one row per customer per UTC day since 2026-11-06 with `snapshot_date`, `arr_amount`, `arr_currency`, `arr_decimals`, `arr_estimated`, `revenue_lifecycle` and the customer's id, name, domain and status; the MRR columns (`mrr_cents`, `mrr_status` and the rest) are gone, and a day with no row was not computed.

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

- [#296](https://github.com/OutlitAI/outlit-sdk/pull/296) [`2f8582a`](https://github.com/OutlitAI/outlit-sdk/commit/2f8582a349fc9ccd8044fd6ea7578cb0be23056a) Thanks [@leo-paz](https://github.com/leo-paz)! - The context tools move to the Agent API v2 shapes: `outlit_get_timeline`, `outlit_get_source`, `outlit_list_sources`, `outlit_search_customer_context`, `outlit_list_facts` and `outlit_get_fact`. This ships in the same release as the customer tools (`customer-tools-v2`), so there is one major bump. A source has one reference everywhere, enum values are lowercase, and lists page and report coverage one way.

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

- [#294](https://github.com/OutlitAI/outlit-sdk/pull/294) [`8be61f9`](https://github.com/OutlitAI/outlit-sdk/commit/8be61f92a94452c1e2595805960fc644e9b6a57e) Thanks [@leo-paz](https://github.com/leo-paz)! - Customer tools move to the Agent API v2 shapes (`outlit_get_customer`, `outlit_list_customers`, `outlit_list_customer_fields`). Money, ARR, billing statuses, pagination and section results have one shape each.

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
  - `limit` still accepts up to 1000; the CLI still caps `--limit` at 100.

  **CLI.** `customers list` keeps its flags and maps them to the new input; `customers get --subscriptions` now goes with `--include billing`. `--billing-status` takes lowercase statuses (comma-separate several); the old uppercase spelling, the old sort names `arr_cents`, `mrr_cents` and `first_seen_at`, and `--mrr-above`/`--mrr-below` are still accepted but no longer advertised. Table output prints `arr.value.formatted` (for example `$60,000.00`, `~` for an estimate) and the lowercase status. JSON output is the v2 result, with `page` in place of `pagination`.

  **Pi and skills.** The default Pi toolset has `outlit_list_customer_fields` in place of `outlit_list_crm_fields`; the Pi skill describes sections and the new filters.

- [#302](https://github.com/OutlitAI/outlit-sdk/pull/302) [`74678fa`](https://github.com/OutlitAI/outlit-sdk/commit/74678fa27c5979390c236b44c7e50f7fbb64d905) Thanks [@leo-paz](https://github.com/leo-paz)! - The churn case tools are hidden from external callers. This ships in the same Agent API v2 release as the work tools (`work-identity-tools-v2`), so there is one major bump. The work toolset is your tasks (Inbox), and acting on them, with undo.

  - `outlit_list_cases` and `outlit_get_case` are gone from `@outlit/tools`, the default and Pi toolsets and the generated contracts, and so are their retired names `outlit_list_attention_items` and `outlit_get_attention_item`. The gateway refuses all four with 403 `TOOL_CALL_FORBIDDEN`.
  - The `AttentionListResult`, `AttentionItemSummary`, `AttentionItemResult` and `AttentionItem` types are removed from `@outlit/tools`.
  - The CLI has no `outlit attention` commands: `attention list` and `attention get` are removed, along with their shell completions.
  - Tasks no longer carry `partOf.case`. `outlit_list_tasks` items keep `partOf.work`, `partOf.title` and `partOf.renewalId`.

- [#298](https://github.com/OutlitAI/outlit-sdk/pull/298) [`7957ab8`](https://github.com/OutlitAI/outlit-sdk/commit/7957ab883b080705898bfea640cacb60863dee45) Thanks [@leo-paz](https://github.com/leo-paz)! - The work and identity tools move to the Agent API v2 shapes. This ships in the same release as the customer and context tools (`customer-tools-v2`, `context-tools-v2`), so there is one major bump. Nine tools change; their commands are unchanged. Core maps the old tool names and input spellings until 2026-12-11, and the old outputs are gone.

  **Tool renames** (the default-toolset and Pi entries change with them):

  | Was                                       | Is                               |
  | ----------------------------------------- | -------------------------------- |
  | `outlit_list_inbox`                       | `outlit_list_tasks`              |
  | `outlit_get_inbox_item`                   | `outlit_get_task`                |
  | `outlit_act_on_inbox_item`                | `outlit_act_on_task`             |
  | `outlit_undo_inbox_action`                | `outlit_undo_task_action`        |
  | `outlit_get_customer_identity`            | `outlit_get_identity`            |
  | `outlit_list_identity_merge_suggestions`  | `outlit_list_merge_suggestions`  |
  | `outlit_reject_identity_merge_suggestion` | `outlit_reject_merge_suggestion` |
  | `outlit_get_customer_merge_status`        | `outlit_get_merge`               |
  | `outlit_merge_customers`                  | same name, new input and output  |

  The case tools are not part of this release: see `hide-case-tools`.

  **Shared shapes.**

  - One resource id input: a task's `itemId`, a suggestion's `suggestionId` and a merge's `operationId` are `id` on that resource's own tools. `customerId` on reads is `customer`, which takes an ID, a domain or a name.
  - Customers are `CustomerRef { id, name, domain }`; extra facts sit beside it (`owner: { id, name, email } | null`, `type`). Lists return `{ items, page }` in place of `pagination` or `{ suggestions, nextCursor }`, plus `coverage { searched }` when empty. Merge suggestions have no total, so their `page.total` is `null`.
  - Enum values are lowercase in inputs and outputs: priority (`urgent`, `high`, `normal`), customer type (`company`, `individual`), merge confidence (`high`, `medium`, `low`), suggestion status (`suggested`, `processing`, `merged`, `rejected`; the `filters.status` input on `outlit_list_merge_suggestions`), output `proposalStatus` (`proposed`, `staged`, `stale`, `rejected`, `applied`), job status (`queued`, `running`, `completed`, `failed`).
  - `undoToken` + `undoUntil` are `undo: { token, until } | null`. `previewToken` + `evaluatedAt` (output) are `preview: { token, expiresAt }` plus `evaluatedAt`; `expiresAt` is `null` because the token has no clock expiry.
  - Source references on identity reasons (`sourceType: "CALL"` + `sourceId`) are `source { type: "call", id }`.
  - `act_on_task`, `undo_task_action` and `reject_merge_suggestion` require `requestId`; a retry with the same id never acts twice.

  **Tasks.**

  - `outlit_list_tasks`: `owner` input is `filters.owner`. Output `owner` is a member (`{ id, name, email }`); `items[].itemId` is `items[].id`; `items[].customer` is a `CustomerRef`; `items[].partOf` is `{ work, title, renewalId }` (`caseId` is gone); `items[].actions` is the actions `outlit_act_on_task` accepts now, or `null` when they could not be read in time; `complete` is `incomplete { reason, next } | null`; `pagination` is `page`.
  - `outlit_get_task`: `itemId` is `id`. New `include` (`source`, `draft`, `covered`; default `source` and `covered`; the prepared reply is opt-in). Output is `{ task, source?, draft?, covered? }`, each a section; `sourcePreview` is `source.data` (without `channel`) and `coveredSteps` is `covered.data.steps`.
  - `outlit_act_on_task`: `itemId` is `id`; `requestId` is required. `until` (snooze only) and `reason` (`wont_do` only) on another action are ignored and named in `ignored[]` instead of refusing the call. Output `itemIds` is `affected.taskIds`; `undoToken` and `undoUntil` are `undo`; `next` is new. An action the task cannot take is `INVALID_TOOL_INPUT` with that task's valid actions.
  - `outlit_undo_task_action`: `requestId` is required. Output `itemIds` is `affected.taskIds`; `next` is new. A token that is invalid or past `undo.until` is `INVALID_TOOL_INPUT` on `undoToken`.

  **Identity.**

  - `outlit_get_identity`: `customerId` is `customer`; new `include: ["links"]` (the customer's records in other systems, the same section as `outlit_get_customer`; unavailable for a read bound to a past moment). Output `coverage { status, reasons }` is `completeness`, and `coverage { searched }` appears when there are no candidates; `evidenceCutoffAt` + `basis` are `cutoff { at, basis } | null`; `candidates[]` are `{ customer: CustomerRef, type, reasons[] { kind, domain, source, field } }`; `next` is new.
  - `outlit_list_merge_suggestions`: `customerId` is `customer`; `suggestionId`, `status` and `confidence` are `filters.id`, `filters.status` and `filters.confidence` (lowercase, one value each). `limit` defaults to 25 (was 50) and caps at 100. `impact`, `scope`, `jevEvidence` and the cluster fields (`candidateCustomers`, `reviewedPairOptions`, `impactScope`) are left out unless `include` asks for `impact`, `scope`, `jev` or `cluster`. Output `suggestions` is `items`; `canManageIdentityMerges` is `canManage`; `survivor` and `duplicate` are `{ customer, type, status, billingStatus, identifiers, contacts }`; `latestJob.operationId` is `latestJob.operation { id } | null`; `reviewedByName` and `appliedByName` are `reviewedBy { name }` and `appliedBy { name }`.
  - `outlit_reject_merge_suggestion`: `suggestionId` is `id`; `reviewNotes` is `note`; `requestId` is required. Output `{ suggestionId, status: "REJECTED" }` is `{ suggestion { id, status: "rejected" }, next }`.
  - `outlit_merge_customers`: `dryRun` is `mode: "preview" | "execute"` (default `preview`); `survivingCustomerId` and `duplicateCustomerId` are `survivor` and `duplicate` (exact IDs only); `reviewNotes` is `note` (execute only). Keys a mode does not take are ignored and named in `ignored[]`. A preview returns `{ mode, survivor, duplicate, preview { token, expiresAt }, evaluatedAt, impact, warnings, links, next }`, where `links` compares the two customers' linked records (`shared`, `conflicting`, `survivorOnly`, `duplicateOnly`, `complete`). An execute returns `{ mode, operation, next }`.
  - `outlit_get_merge`: `operationId` is `id`. Output `{ kind, operationId, survivingCustomerId, duplicateCustomerId, status, phase, error }` is `{ operation { id, survivor, duplicate, status, phase, failure }, next }`. `failure.code` is `not_started` (nothing moved: preview the pair again) or `incomplete` (Outlit is recovering it: keep polling, never execute again).

  **CLI.** Command paths and flag names are unchanged; the CLI maps them to the new inputs. `customers merge` maps `--execute` to `mode` and `--review-notes` to `note` (sent with `--execute` only); `--preview-token` and `--request-id` stay required with `--execute`. `identity suggestions list` maps `--customer-id` to `customer` and `--suggestion-id`, `--status` and `--confidence` to `filters`, with `--confidence` lowercase (the uppercase spelling is still accepted but no longer advertised), and `--limit` defaults to 25. `--include impact,scope,jev,cluster` is new there, and `customers identity --links` is new. `identity suggestions reject` sends a new `requestId` each run; pass `--request-id` to reuse one on a retry. `customers merge-status <operationId>` sends it as `id`. JSON output is the v2 result (`page`, `owner`, `importance`, `operation`, `undo`).

  **Pi and skills.** The Pi toolset and skills use the new tool names.

### Minor Changes

- [#299](https://github.com/OutlitAI/outlit-sdk/pull/299) [`6ff7152`](https://github.com/OutlitAI/outlit-sdk/commit/6ff71524f0c51910bec9e6fc4de24112e77f99a0) Thanks [@leo-paz](https://github.com/leo-paz)! - Customer hierarchy: a customer's parent company and its direct subsidiaries, as parent accounts in the organization's HubSpot or Salesforce CRM record them.

  - `outlit_get_customer` takes `include: ["hierarchy"]`: `{ parent, children, page }`, each a customer (`id`, `name`, `domain`) with `source` (`crm`) and `since`. Children come in pages of 25 (at most 100) with `hierarchy: { limit, cursor }`. `customerIncludeSections` gains `hierarchy`.
  - `outlit_list_customers` takes `filters.partOf`, a customer by ID, domain or name: only its direct subsidiaries, with every other filter and the ARR totals.
  - CLI: `outlit customers get <customer> --include hierarchy` (with `--limit` and `--cursor`), and `outlit customers list --part-of <customer>`.

### Patch Changes

- [#295](https://github.com/OutlitAI/outlit-sdk/pull/295) [`59e7ccd`](https://github.com/OutlitAI/outlit-sdk/commit/59e7ccdf6885e1e9e4e936038e2eea8ed6b00ae7) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_get_source`, `outlit_list_sources` and `outlit_search_customer_context` accept the `CRM_NOTE` source type: the notes reps log in the CRM (HubSpot first). `outlit_list_sources` lists them only for a customer and only when `sourceType` is `CRM_NOTE`. It is behind a per-workspace flag.

- [#291](https://github.com/OutlitAI/outlit-sdk/pull/291) [`b313b17`](https://github.com/OutlitAI/outlit-sdk/commit/b313b17c34102356ed4e65cd907392ae0467365e) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_list_customers` rows can carry `crmSummary`: the customer's CRM and support tool accounts at a glance, by field label (the stage and the first custom picklists, numbers and yes/no fields, at most 4 per account from 3 accounts). It is behind a per-workspace flag and absent when `crmFields` is given.

- [#291](https://github.com/OutlitAI/outlit-sdk/pull/291) [`b313b17`](https://github.com/OutlitAI/outlit-sdk/commit/b313b17c34102356ed4e65cd907392ae0467365e) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_get_customer` can return `crmSummary` in its base response: each linked CRM and support tool account at a glance, with its stage and the custom picklists, numbers and yes/no fields that system holds, at most 8 per account. It is behind a per-workspace flag and absent when `include crm` is requested.

- [#293](https://github.com/OutlitAI/outlit-sdk/pull/293) [`fe602ce`](https://github.com/OutlitAI/outlit-sdk/commit/fe602ce69d400e7c237dcade88608931aafd40b3) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_assign_customer_owner`, `outlit_create_destination`, `outlit_update_destination`, `outlit_enable_destination`, `outlit_disable_destination`, `outlit_update_customer_activation`, `outlit_update_workspace_settings`, `outlit_setup_integration`, `outlit_act_on_inbox_item` and `outlit_undo_inbox_action` are now `destructiveHint: true`, since each can overwrite an existing value (the owner, a destination's settings or enabled state, the activation event, workspace defaults, an integration's credentials and configuration, or an Inbox task's state). Clients that act on MCP annotations can use this to ask before running them, depending on their own policy.

- Updated dependencies [[`dc04f36`](https://github.com/OutlitAI/outlit-sdk/commit/dc04f369ba82111041564e06ababf3619e7d4a0b), [`2930edd`](https://github.com/OutlitAI/outlit-sdk/commit/2930edd1a83cd20af335cde1f6a6b519428feadb), [`2f8582a`](https://github.com/OutlitAI/outlit-sdk/commit/2f8582a349fc9ccd8044fd6ea7578cb0be23056a), [`59e7ccd`](https://github.com/OutlitAI/outlit-sdk/commit/59e7ccdf6885e1e9e4e936038e2eea8ed6b00ae7), [`b313b17`](https://github.com/OutlitAI/outlit-sdk/commit/b313b17c34102356ed4e65cd907392ae0467365e), [`b313b17`](https://github.com/OutlitAI/outlit-sdk/commit/b313b17c34102356ed4e65cd907392ae0467365e), [`6ff7152`](https://github.com/OutlitAI/outlit-sdk/commit/6ff71524f0c51910bec9e6fc4de24112e77f99a0), [`8be61f9`](https://github.com/OutlitAI/outlit-sdk/commit/8be61f92a94452c1e2595805960fc644e9b6a57e), [`74678fa`](https://github.com/OutlitAI/outlit-sdk/commit/74678fa27c5979390c236b44c7e50f7fbb64d905), [`fe602ce`](https://github.com/OutlitAI/outlit-sdk/commit/fe602ce69d400e7c237dcade88608931aafd40b3), [`7957ab8`](https://github.com/OutlitAI/outlit-sdk/commit/7957ab883b080705898bfea640cacb60863dee45)]:
  - @outlit/tools@3.0.0

## 3.4.0

### Minor Changes

- [#287](https://github.com/OutlitAI/outlit-sdk/pull/287) [`bc278e0`](https://github.com/OutlitAI/outlit-sdk/commit/bc278e0c616b2987ec29026553adab0f57a9e654) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_get_customer` revenue lists the customer's Stripe billing accounts and each subscription's billing account and end date; `subscriptions: "all"` (CLI `--subscriptions all`) adds the most recently canceled subscriptions.

- [#284](https://github.com/OutlitAI/outlit-sdk/pull/284) [`06a29b3`](https://github.com/OutlitAI/outlit-sdk/commit/06a29b30d4db860c29fb6c95770dc2dc91cfd47b) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_list_customers` accepts `arrCurrency` to keep customers whose ARR is in one currency, and its response carries `arrCurrencies`, the currencies among the matched customers, whenever it ordered or bounded by ARR. Outlit never converts ARR, so more than one currency there means the ranking compared amounts in different currencies. `outlit customers list` gains `--currency`.

### Patch Changes

- [#282](https://github.com/OutlitAI/outlit-sdk/pull/282) [`0addb1e`](https://github.com/OutlitAI/outlit-sdk/commit/0addb1ed4278733bc5b010f06f7c2fe1cb7a4c25) Thanks [@leo-paz](https://github.com/leo-paz)! - Every public tool now declares `idempotentHint` as `true` or `false`, so MCP clients and app stores that require all four hints get an explicit value. `outlit_update_customer_access` and `outlit_grant_customer_access` are now `destructiveHint: true`, since either can move an Editor to Viewer and remove edit rights. `outlit_assign_customer_owner` is `idempotentHint: false`, since every call restamps the assignment time.

- Updated dependencies [[`3cf621a`](https://github.com/OutlitAI/outlit-sdk/commit/3cf621a675cf8c2078243cf05946dba95af54e49), [`6277cf0`](https://github.com/OutlitAI/outlit-sdk/commit/6277cf07821740341d8a94d3043243bcae39c5a7), [`2c3092c`](https://github.com/OutlitAI/outlit-sdk/commit/2c3092cdc415f67bf15972ee74d31d07187a291b), [`255dd70`](https://github.com/OutlitAI/outlit-sdk/commit/255dd7076c31903c41dd34f20e957ca5855808ad), [`bc278e0`](https://github.com/OutlitAI/outlit-sdk/commit/bc278e0c616b2987ec29026553adab0f57a9e654), [`cea8bfd`](https://github.com/OutlitAI/outlit-sdk/commit/cea8bfd80a9839fb5276d68b2b6d9eb2bfd428d3), [`06a29b3`](https://github.com/OutlitAI/outlit-sdk/commit/06a29b30d4db860c29fb6c95770dc2dc91cfd47b), [`0addb1e`](https://github.com/OutlitAI/outlit-sdk/commit/0addb1ed4278733bc5b010f06f7c2fe1cb7a4c25)]:
  - @outlit/tools@2.5.0

## 3.3.0

### Minor Changes

- [#274](https://github.com/OutlitAI/outlit-sdk/pull/274) [`e5029e2`](https://github.com/OutlitAI/outlit-sdk/commit/e5029e2355b3cf9a22adc8fce4371240c0c30a36) Thanks [@leo-paz](https://github.com/leo-paz)! - Revenue is now ARR, the annualized revenue run rate the Outlit app shows. Breaking output change for `@outlit/tools` consumers: the legacy monthly `currentMrr` and `mrrCalculationStatus` fields are removed. `outlit_list_customers` items carry `arr: { amount, currency, estimated } | null`, and `outlit_get_customer` revenue carries `arr` with its `lifecycle` and the `parts` it is counted from (subscriptions, usage, invoiced in the last 12 months). `outlit_list_customers` takes `arrAbove`, `arrBelow` and `orderBy: "arr_cents"`; `mrrAbove`, `mrrBelow` and `mrr_cents` still work but are deprecated. `outlit_get_customer` can `include` `renewal`: the renewal date the customer page shows, with its source (`outlit`, `crm` or `billing`). `outlit_get_source` and `outlit_list_sources` read Stripe invoices with every line item through the new `INVOICE` source type (`outlit_get_source`, `outlit_list_sources` and the matching `outlit sources get` and `outlit sources list` also accept `STRIPE_INVOICE` as an alias; search and facts list do not). The SQL `customers` view gains `arr_cents`, `arr_currency`, `arr_estimated` and `revenue_lifecycle`; `mrr_cents` and `mrr_status` remain for about a month, deprecated.

  The CLI adds `outlit customers list --arr-above`, `--arr-below` and `--order-by arr_cents`, and the table's MRR column becomes ARR, shown with its currency. `--mrr-above`, `--mrr-below` and `mrr_cents` are still accepted but no longer advertised. The Pi SQL reference now uses `arr_cents`.

- [#278](https://github.com/OutlitAI/outlit-sdk/pull/278) [`99ce585`](https://github.com/OutlitAI/outlit-sdk/commit/99ce5858523f8f1dd73425fb95d2eaed09cef15a) Thanks [@leo-paz](https://github.com/leo-paz)! - `outlit_setup_integration` gains an optional Stripe step: a ready Stripe connection can return a `stripe_renewal_date_field` next transition listing subscription metadata keys, and accepts `configuration: { kind: "stripe_renewal_date_field", key }` (or `key: null`) to choose the field renewal dates are read from.

  `outlit integrations setup stripe` lists the metadata keys and lets you pick the renewal date field or skip it; with `--json` or `--config-stdin` it returns the step so an agent can rerun with the chosen key.

### Patch Changes

- Updated dependencies [[`e5029e2`](https://github.com/OutlitAI/outlit-sdk/commit/e5029e2355b3cf9a22adc8fce4371240c0c30a36), [`6a5e0eb`](https://github.com/OutlitAI/outlit-sdk/commit/6a5e0ebf84f7dc7d0717d22444084e5cce1753c5), [`99ce585`](https://github.com/OutlitAI/outlit-sdk/commit/99ce5858523f8f1dd73425fb95d2eaed09cef15a)]:
  - @outlit/tools@2.4.0

## 3.2.8

### Patch Changes

- [#272](https://github.com/OutlitAI/outlit-sdk/pull/272) [`f84fff5`](https://github.com/OutlitAI/outlit-sdk/commit/f84fff5c660c1b1ebe0ffe8053e845c1b7fdbe3e) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the Inbox read tools to the generated public tool contracts and the OpenAPI document: `outlit_list_inbox` lists one section of a person's Inbox (today, open, snoozed, done or pool) as tasks, each with its task `itemId`, what it asks, what it is part of, its customer and what it answers; `outlit_get_inbox_item` reads one task by that id with its source preview, prepared reply and covered tasks. Outlit turns them on per workspace.

- [#273](https://github.com/OutlitAI/outlit-sdk/pull/273) [`7e515aa`](https://github.com/OutlitAI/outlit-sdk/commit/7e515aade75e113d1bdeb6a8fc9a6c80cba25147) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the Inbox write tools to the generated public tool contracts and the OpenAPI document: `outlit_act_on_inbox_item` takes a person's own action on one Inbox task by `itemId` (done, won't do, wrong, reopen, snooze, unsnooze, take, put back, not covered) and returns an `undoToken`; `outlit_undo_inbox_action` reverses it with that token. Rows' `actions` stay empty for now. Outlit turns them on per workspace.

- [#267](https://github.com/OutlitAI/outlit-sdk/pull/267) [`0194ae3`](https://github.com/OutlitAI/outlit-sdk/commit/0194ae3760b15360d56c9ca906cbbd614cafab3f) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove the four scoped identity repair tools (`outlit_list_scoped_repairs`, `outlit_preview_scoped_repair`, `outlit_execute_scoped_repair`, `outlit_verify_scoped_repair`) from the generated public tool contracts and the OpenAPI document. Outlit no longer offers them to customers over MCP, the CLI, Pi or the API; scoped repairs stay available on the Identity page in the Outlit app.

- Updated dependencies [[`f84fff5`](https://github.com/OutlitAI/outlit-sdk/commit/f84fff5c660c1b1ebe0ffe8053e845c1b7fdbe3e), [`7e515aa`](https://github.com/OutlitAI/outlit-sdk/commit/7e515aade75e113d1bdeb6a8fc9a6c80cba25147), [`0194ae3`](https://github.com/OutlitAI/outlit-sdk/commit/0194ae3760b15360d56c9ca906cbbd614cafab3f)]:
  - @outlit/tools@2.3.0

## 3.2.7

### Patch Changes

- [#254](https://github.com/OutlitAI/outlit-sdk/pull/254) [`ea43a1f`](https://github.com/OutlitAI/outlit-sdk/commit/ea43a1f25ef17126b374c6abbe53073bc91d1135) Thanks [@leo-paz](https://github.com/leo-paz)! - Add personal Circleback and Pocket API-key integration setup contracts.

- Updated dependencies [[`ea43a1f`](https://github.com/OutlitAI/outlit-sdk/commit/ea43a1f25ef17126b374c6abbe53073bc91d1135)]:
  - @outlit/tools@2.2.6

## 3.2.6

### Patch Changes

- [#250](https://github.com/OutlitAI/outlit-sdk/pull/250) [`8f567e4`](https://github.com/OutlitAI/outlit-sdk/commit/8f567e4ca847e9757dd1c524707eace006d14c9b) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts so each user from `outlit_list_users` and `outlit_get_customer` (with `users`) can say where Outlit found them: an optional `sources` list of `{ system, kind, count, firstSeenAt, lastSeenAt }`. Records (a CRM or support-tool `contact`, a `product_user`, a Slack `chat_member`, a `billing_customer`) have a null `count`; conversations the person took part in (`call`, `meeting`, `email`, `support_ticket`, `slack_thread`) carry how many and when. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `sources` as unknown, not empty. The CLI docs show the field. Companion to OutlitAI/Core#2957.

- Updated dependencies [[`8f567e4`](https://github.com/OutlitAI/outlit-sdk/commit/8f567e4ca847e9757dd1c524707eace006d14c9b)]:
  - @outlit/tools@2.2.5

## 3.2.5

### Patch Changes

- [#245](https://github.com/OutlitAI/outlit-sdk/pull/245) [`24fdff7`](https://github.com/OutlitAI/outlit-sdk/commit/24fdff7b1af5e064cf2a304ff90ae2754c06ea4c) Thanks [@leo-paz](https://github.com/leo-paz)! - Sync the API key validation contract v2 from Core: `apiKeyContractHeader` and `apiKeyValidationSuccessSchemaV2` add `apiKey.expiresAt`, returned only when a client sends `Outlit-Api-Key-Contract: 2`. The CLI now asks for v2 when it validates a key, still accepts v1 responses, and warns on stderr (once per run) when the key expires within 14 days, suggesting `outlit login`.

- Updated dependencies [[`24fdff7`](https://github.com/OutlitAI/outlit-sdk/commit/24fdff7b1af5e064cf2a304ff90ae2754c06ea4c)]:
  - @outlit/tools@2.2.4

## 3.2.4

### Patch Changes

- [#238](https://github.com/OutlitAI/outlit-sdk/pull/238) [`080062f`](https://github.com/OutlitAI/outlit-sdk/commit/080062f673e4f62d0440a46aaf6b7c23edee5a7a) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose Core's four scoped identity repair tools and expanded customer merge impact contract through the generated SDK tool schemas and OpenAPI document, and release compatible CLI and Pi consumers.

- [#242](https://github.com/OutlitAI/outlit-sdk/pull/242) [`157af7e`](https://github.com/OutlitAI/outlit-sdk/commit/157af7eb2c27cfdc4513cb85767fe1945cd58080) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts so each `outlit_search_customer_context` result can name its customer: `source` and `fact` results carry an optional `customer` (`id`, `name`, `domain`), which is `null` when the result can't be attributed to exactly one customer the caller can read. A search across customers now says whose source or fact matched. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `customer` like `null`. The API reference and CLI docs show the field. Companion to OutlitAI/Core#2569.

- [#239](https://github.com/OutlitAI/outlit-sdk/pull/239) [`b49f582`](https://github.com/OutlitAI/outlit-sdk/commit/b49f582fcef19b13faf43c52f971d183f49b9e05) Thanks [@leo-paz](https://github.com/leo-paz)! - Regenerate tool contracts with the unit on money fields: `currentMrr` and `lifetimeRevenue` (list and get customer) and `accountImportance.arrCents` (attention) are in the billing provider's units for the currency they were billed in. For USD, EUR, GBP and CAD these are cents, so divide by 100; other currencies follow the provider's amount rules, so the descriptions don't assume a divisor for them. ARR is 12 × `currentMrr` in the same units. The CLI's `--mrr-above`/`--mrr-below` help and shell completions now say the threshold is in `currentMrr`'s units rather than cents, and the CLI and agent docs state the same units. Descriptions only; no field shapes change. Companion to OutlitAI/Core#2557.

- Updated dependencies [[`080062f`](https://github.com/OutlitAI/outlit-sdk/commit/080062f673e4f62d0440a46aaf6b7c23edee5a7a), [`157af7e`](https://github.com/OutlitAI/outlit-sdk/commit/157af7eb2c27cfdc4513cb85767fe1945cd58080), [`b49f582`](https://github.com/OutlitAI/outlit-sdk/commit/b49f582fcef19b13faf43c52f971d183f49b9e05)]:
  - @outlit/tools@2.2.3

## 3.2.3

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

## 3.2.2

### Patch Changes

- [#219](https://github.com/OutlitAI/outlit-sdk/pull/219) [`b8b79a2`](https://github.com/OutlitAI/outlit-sdk/commit/b8b79a2350753d0b180889bc7dd7c7e295ec3874) Thanks [@leo-paz](https://github.com/leo-paz)! - Improve `outlit doctor` permission diagnostics and fix the standalone update notifier. Doctor now shows the organization and effective key grants from the existing validation response, lists commands unavailable to the key with per-operation read/manage precision (for example, a read-only key can still list identity suggestions and preview merges while reject and execute remain unavailable), and explains missing integrations access instead of making a guaranteed-denied request. The background update check on compiled binaries now respawns the real executable instead of relying on a possibly-missing bun runtime and a virtual `$bunfs` entrypoint, asynchronous spawn failures no longer crash the foreground command, and update notices share the standalone manual-update guidance instead of prescribing package-manager commands the binary cannot use.

## 3.2.1

### Patch Changes

- [#217](https://github.com/OutlitAI/outlit-sdk/pull/217) [`848aa20`](https://github.com/OutlitAI/outlit-sdk/commit/848aa20f3db45423a06a351d8f2bb0cf01e2f006) Thanks [@leo-paz](https://github.com/leo-paz)! - Improve `outlit upgrade` for machine callers and standalone installs: check the registry before installer detection so already-current installs get a definitive answer, add `--json`/non-TTY structured output (`status`, `currentVersion`, `latestVersion`), route package-manager output to stderr in JSON mode so stdout stays valid, and give standalone compiled binaries manual-update guidance (install script, Homebrew, GitHub releases) instead of an unactionable `unknown_installer`.

- Updated dependencies [[`848aa20`](https://github.com/OutlitAI/outlit-sdk/commit/848aa20f3db45423a06a351d8f2bb0cf01e2f006)]:
  - @outlit/tools@2.2.1

## 3.2.0

### Minor Changes

- [#209](https://github.com/OutlitAI/outlit-sdk/pull/209) [`485f4f0`](https://github.com/OutlitAI/outlit-sdk/commit/485f4f0c8f686100ab64414733e56b8a2e267041) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the shared customer identity diagnostic, saved suggestion review, and exact customer merge contracts. Preserve merge safety annotations in generated contracts. Add CLI commands for identity reads, suggestion list/reject, merge preview or explicit execution, and operation status. Merging requires the matching Core deployment and an explicitly granted credential.

### Patch Changes

- [#211](https://github.com/OutlitAI/outlit-sdk/pull/211) [`13a605f`](https://github.com/OutlitAI/outlit-sdk/commit/13a605fdfd241e583635218276eb306ba493b894) Thanks [@leo-paz](https://github.com/leo-paz)! - Add optional customer provider feature balance output, Autumn and Ergo API-key setup contracts, and interactive CLI credential prompts. Stable publication requires the matching Core Autumn integration to be deployed and verified first.

- [#214](https://github.com/OutlitAI/outlit-sdk/pull/214) [`591f4fc`](https://github.com/OutlitAI/outlit-sdk/commit/591f4fc5df40858e9b5c0aeea94cd39549cf711a) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `outlit customers credits <customer>` and its public tool `outlit_get_customer_credits`, and sync the generated contract with Core. The command returns imported customer credit pools, observation state, reset timing, and deterministic burn summaries. Stable publication requires the matching Core change to be deployed and verified first.

  Expand `outlit customers features` and `outlit_get_customer_features` to return event and imported metered usage with source availability, coverage, and optional weekly history. Credit pools belong to the dedicated Credits command; remove the unreleased `featureBalances` section from customer-get includes. Existing `recentTimeline` and `behaviorMetrics` includes remain unchanged.

- Updated dependencies [[`13a605f`](https://github.com/OutlitAI/outlit-sdk/commit/13a605fdfd241e583635218276eb306ba493b894), [`cb26b4c`](https://github.com/OutlitAI/outlit-sdk/commit/cb26b4c221318005393c6ae2c76f232a17ee2d39), [`591f4fc`](https://github.com/OutlitAI/outlit-sdk/commit/591f4fc5df40858e9b5c0aeea94cd39549cf711a), [`3c7c0d0`](https://github.com/OutlitAI/outlit-sdk/commit/3c7c0d069fa491261f71ba4b6e1a961a33783b8b), [`485f4f0`](https://github.com/OutlitAI/outlit-sdk/commit/485f4f0c8f686100ab64414733e56b8a2e267041), [`1fd4bd2`](https://github.com/OutlitAI/outlit-sdk/commit/1fd4bd209560a8218cb91985a7c0d5895effd565)]:
  - @outlit/tools@2.2.0

## 3.1.3

### Patch Changes

- [#205](https://github.com/OutlitAI/outlit-sdk/pull/205) [`79dc13a`](https://github.com/OutlitAI/outlit-sdk/commit/79dc13a46751b4fd7a8b0c6c491b1069c536af8d) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose bounded exact-source content pages, occurrence-time fact filters, and typed oversized tool-result errors.

- [#207](https://github.com/OutlitAI/outlit-sdk/pull/207) [`bac6a85`](https://github.com/OutlitAI/outlit-sdk/commit/bac6a85c7e7dca3dd3a24ea0b73e83d1ee6e4b4e) Thanks [@leo-paz](https://github.com/leo-paz)! - Align exact-source pagination help with the generated content-segment contract.

- Updated dependencies [[`79dc13a`](https://github.com/OutlitAI/outlit-sdk/commit/79dc13a46751b4fd7a8b0c6c491b1069c536af8d)]:
  - @outlit/tools@2.1.3

## 3.1.2

### Patch Changes

- [#201](https://github.com/OutlitAI/outlit-sdk/pull/201) [`d743465`](https://github.com/OutlitAI/outlit-sdk/commit/d743465964df644a340e3fde70778a54a32bbb72) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose contact departure, position change, and disengagement facts through the generated customer fact filters.

- [#203](https://github.com/OutlitAI/outlit-sdk/pull/203) [`3214815`](https://github.com/OutlitAI/outlit-sdk/commit/321481599c1ca61b5c198ae776055208ba824fdd) Thanks [@leo-paz](https://github.com/leo-paz)! - Document the public contact-transition fact filters in CLI help and the bundled Pi guidance.

- Updated dependencies [[`d743465`](https://github.com/OutlitAI/outlit-sdk/commit/d743465964df644a340e3fde70778a54a32bbb72), [`1de7d3f`](https://github.com/OutlitAI/outlit-sdk/commit/1de7d3fc1fdf6c56f09cfd7c8808f5d43270974d)]:
  - @outlit/tools@2.1.2

## 3.1.1

### Patch Changes

- [#199](https://github.com/OutlitAI/outlit-sdk/pull/199) [`b933cf1`](https://github.com/OutlitAI/outlit-sdk/commit/b933cf1c09e6fdc3ae37274dfea34551c18c5d90) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose customer contact relationship and professional profile fields in the generated people contracts.

- Updated dependencies [[`b933cf1`](https://github.com/OutlitAI/outlit-sdk/commit/b933cf1c09e6fdc3ae37274dfea34551c18c5d90)]:
  - @outlit/tools@2.1.1

## 3.1.0

### Minor Changes

- [#195](https://github.com/OutlitAI/outlit-sdk/pull/195) [`dbcbe4c`](https://github.com/OutlitAI/outlit-sdk/commit/dbcbe4c0f1661b1c599ba0f6cda1ca1b0a4eee50) Thanks [@leo-paz](https://github.com/leo-paz)! - Replace the public Behavior Metric and Value Feature surfaces with one canonical Feature lifecycle.
  Use `outlit features list|create|archive` and `outlit customers features`; the generated public tools
  are `outlit_list_features`, `outlit_create_feature`, `outlit_archive_feature`, and
  `outlit_get_customer_features`. Creating a Feature still atomically creates the supporting weekly
  event-count and active-days metrics inside Outlit.

### Patch Changes

- [#193](https://github.com/OutlitAI/outlit-sdk/pull/193) [`2ab7311`](https://github.com/OutlitAI/outlit-sdk/commit/2ab7311de9e1d9a432669395f61b17a29712d96a) Thanks [@leo-paz](https://github.com/leo-paz)! - Add a bounded `customers relationship` command and typed customer relationship result for the
  authorized customer-detail tool. The response provides the UI-aligned Relationship projection
  rather than internal fact or memory-card records.

  Normalize Attention list pagination and public names for owner, same-currency ARR cohort
  metrics, and the current reviewable prepared-action URL.

- [#196](https://github.com/OutlitAI/outlit-sdk/pull/196) [`d37138d`](https://github.com/OutlitAI/outlit-sdk/commit/d37138d98fc1c1e868ae1f1a578ec0bbe0902d4f) Thanks [@leo-paz](https://github.com/leo-paz)! - Align CLI and Pi public examples with current generated contracts and policy exports.

- [#193](https://github.com/OutlitAI/outlit-sdk/pull/193) [`b25bbee`](https://github.com/OutlitAI/outlit-sdk/commit/b25bbee0010fb5f3de0f81951d22da7374b79009) Thanks [@leo-paz](https://github.com/leo-paz)! - Add read-only Attention list and detail contracts plus `outlit attention list` and
  `outlit attention get <id>`. Attention exposes bounded, authorized customer-risk detail with
  Core-owned finite nonnegative ARR values and no email draft content or internal
  agent state. V1 list filtering is limited to lifecycle and customer; each row
  still reports its current priority.
- Updated dependencies [[`2ab7311`](https://github.com/OutlitAI/outlit-sdk/commit/2ab7311de9e1d9a432669395f61b17a29712d96a), [`dbcbe4c`](https://github.com/OutlitAI/outlit-sdk/commit/dbcbe4c0f1661b1c599ba0f6cda1ca1b0a4eee50), [`b25bbee`](https://github.com/OutlitAI/outlit-sdk/commit/b25bbee0010fb5f3de0f81951d22da7374b79009), [`0d3bfd6`](https://github.com/OutlitAI/outlit-sdk/commit/0d3bfd63de335b7b59d6523efbbde51f8d8f2061)]:
  - @outlit/tools@2.1.0

## 3.0.0

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

- [#188](https://github.com/OutlitAI/outlit-sdk/pull/188) [`222bba6`](https://github.com/OutlitAI/outlit-sdk/commit/222bba6c3ad50138a0e3a84013a322a7bfe2b35a) Thanks [@leo-paz](https://github.com/leo-paz)! - Add first-class `customers owner set`, `customers grant`, and `customers revoke` commands with all-member exact-ID discovery guidance, split API-key grant documentation, local contract validation, and synchronized Core contract metadata. Re-running `grant` changes an existing collaborator's Viewer/Editor role.

### Patch Changes

- [#181](https://github.com/OutlitAI/outlit-sdk/pull/181) [`327eef1`](https://github.com/OutlitAI/outlit-sdk/commit/327eef1012d8fba8e76f22c0947fd484dc3d21fb) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose Core's customer owner and sharing tool contracts to SDK tool consumers. Republish the
  CLI and Pi wrappers with their compatible tool-runtime dependency.

- [#190](https://github.com/OutlitAI/outlit-sdk/pull/190) [`975249a`](https://github.com/OutlitAI/outlit-sdk/commit/975249aa249f5677d42929664c1f5161dcd914da) Thanks [@leo-paz](https://github.com/leo-paz)! - Include Slack conversations in the deterministic source-listing CLI help.

- [#183](https://github.com/OutlitAI/outlit-sdk/pull/183) [`ba4380a`](https://github.com/OutlitAI/outlit-sdk/commit/ba4380aefb9c137a527cd8d9a2d1913a8817c24e) Thanks [@leo-paz](https://github.com/leo-paz)! - Route Stripe through the Core-advertised OAuth handoff and reject legacy provider credential arguments.

- Updated dependencies [[`2ec7678`](https://github.com/OutlitAI/outlit-sdk/commit/2ec7678f93187e9287b3ed3216fe27ffc86c0540), [`222bba6`](https://github.com/OutlitAI/outlit-sdk/commit/222bba6c3ad50138a0e3a84013a322a7bfe2b35a), [`327eef1`](https://github.com/OutlitAI/outlit-sdk/commit/327eef1012d8fba8e76f22c0947fd484dc3d21fb), [`d5360f8`](https://github.com/OutlitAI/outlit-sdk/commit/d5360f8485252dfe4772876b1b44a9488b1f3d32)]:
  - @outlit/tools@2.0.0

## 2.0.0

### Major Changes

- [#176](https://github.com/OutlitAI/outlit-sdk/pull/176) [`65ae3ac`](https://github.com/OutlitAI/outlit-sdk/commit/65ae3aca590682d9de07ba0168cab49dbe06eb5c) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove retired generic agent, automation, signal, identity, and notification surfaces from the public tools, CLI, and Pi packages. Public tool contracts, toolset memberships, gateway transport, OpenAPI, and ingest transport now derive from Core's capability catalog. Tracking packages expose only Platform-accepted event types; stage and billing lifecycle APIs remain removed across TypeScript and Rust.

### Patch Changes

- [#177](https://github.com/OutlitAI/outlit-sdk/pull/177) [`2dd6b8e`](https://github.com/OutlitAI/outlit-sdk/commit/2dd6b8e33aac2c3658b760f4c76a884cc6e3dde2) Thanks [@leo-paz](https://github.com/leo-paz)! - Sync customer tool contracts with Core, including customer enrichment, aligned input bounds, and updated customer and source descriptions.

- Updated dependencies [[`2dd6b8e`](https://github.com/OutlitAI/outlit-sdk/commit/2dd6b8e33aac2c3658b760f4c76a884cc6e3dde2), [`65ae3ac`](https://github.com/OutlitAI/outlit-sdk/commit/65ae3aca590682d9de07ba0168cab49dbe06eb5c)]:
  - @outlit/tools@1.0.0

## 1.9.2

### Patch Changes

- [#172](https://github.com/OutlitAI/outlit-sdk/pull/172) [`4598a69`](https://github.com/OutlitAI/outlit-sdk/commit/4598a692e73df8bdce91dcae6d9aeb04f565aecd) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose Slack reply pagination flags on `outlit sources get`.

## 1.9.1

### Patch Changes

- [#170](https://github.com/OutlitAI/outlit-sdk/pull/170) [`c1bef1d`](https://github.com/OutlitAI/outlit-sdk/commit/c1bef1dbd918b32e0ca5f7076070c24c5c848be3) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose pagination fields for exact Slack source lookups.

- Updated dependencies [[`c1bef1d`](https://github.com/OutlitAI/outlit-sdk/commit/c1bef1dbd918b32e0ca5f7076070c24c5c848be3)]:
  - @outlit/tools@0.3.1

## 1.9.0

### Minor Changes

- [#136](https://github.com/OutlitAI/outlit-sdk/pull/136) [`332efcc`](https://github.com/OutlitAI/outlit-sdk/commit/332efccf97feede381825d9c7cd0f511ec099e25) Thanks [@leo-paz](https://github.com/leo-paz)! - Add agent onboarding and integration setup helpers for non-interactive CLI flows. `outlit integrations setup` is now the canonical provider setup command, and legacy `integrations add` plus destructive CLI disconnect/remove access are no longer exposed.

- [#151](https://github.com/OutlitAI/outlit-sdk/pull/151) [`341f6f1`](https://github.com/OutlitAI/outlit-sdk/commit/341f6f1d791d14d09f9a6a133b9920118ffbecab) Thanks [@leo-paz](https://github.com/leo-paz)! - Add agent configuration commands for listing agents, getting an agent, listing templates, listing available actions, and creating draft agents from templates.

- [#164](https://github.com/OutlitAI/outlit-sdk/pull/164) [`fa7ba55`](https://github.com/OutlitAI/outlit-sdk/commit/fa7ba55868c73ed72b46ee7f320fab0423742d74) Thanks [@leo-paz](https://github.com/leo-paz)! - Add activation event get, historical preview, update, and disable commands for the shared
  contact/company activation event; expose nullable company activation timestamps and the
  additive activated-since customer filter.

- [#152](https://github.com/OutlitAI/outlit-sdk/pull/152) [`aa0445f`](https://github.com/OutlitAI/outlit-sdk/commit/aa0445f49e3f4d3d2309c1f513a45aeaad5243f5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add read-only `automations`, `signals`, and `destinations` CLI commands backed by direct platform action API routes.

- [#138](https://github.com/OutlitAI/outlit-sdk/pull/138) [`0ef8f2d`](https://github.com/OutlitAI/outlit-sdk/commit/0ef8f2da1e55aec852c1abf0638b640448a39205) Thanks [@leo-paz](https://github.com/leo-paz)! - Rename the public integration setup mode for browser-based provider setup to `browser_auth` and remove backend-specific wording from CLI help and docs.

- [#142](https://github.com/OutlitAI/outlit-sdk/pull/142) [`8693011`](https://github.com/OutlitAI/outlit-sdk/commit/8693011d63919b3ae7c6fa5bc1a3ea3b692b508e) Thanks [@leo-paz](https://github.com/leo-paz)! - Expose the `ws-users` CLI command, workspace-user discovery tools, and customer owner filters for dynamic customer reports.

### Patch Changes

- [#165](https://github.com/OutlitAI/outlit-sdk/pull/165) [`9c962ff`](https://github.com/OutlitAI/outlit-sdk/commit/9c962ff1d04d138f63ec5a0a37f8aa64577983dc) Thanks [@leo-paz](https://github.com/leo-paz)! - Explain the separate bounded contact and company impact counts returned by activation preview,
  including the grain-specific flags that indicate lower-bound totals.

- [#139](https://github.com/OutlitAI/outlit-sdk/pull/139) [`664e93c`](https://github.com/OutlitAI/outlit-sdk/commit/664e93cd8e1851f0183602ca07643b72a500ba35) Thanks [@leo-paz](https://github.com/leo-paz)! - Update timeline tool contracts to use canonical event channel values.

- [#159](https://github.com/OutlitAI/outlit-sdk/pull/159) [`ee68785`](https://github.com/OutlitAI/outlit-sdk/commit/ee68785ac9e28c2a7e1441aefffc6abd0449d705) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove stale custom-agent criteria flags now that guidance belongs in unified instructions.

- [#144](https://github.com/OutlitAI/outlit-sdk/pull/144) [`29ca464`](https://github.com/OutlitAI/outlit-sdk/commit/29ca4643c9c236a589eedfc348ca9fa031c2a966) Thanks [@leo-paz](https://github.com/leo-paz)! - Sync notification tool contracts with hosted churn agent destination IDs.

- [#157](https://github.com/OutlitAI/outlit-sdk/pull/157) [`750f002`](https://github.com/OutlitAI/outlit-sdk/commit/750f00216a5e8da9cb0c929740a5644220150a08) Thanks [@leo-paz](https://github.com/leo-paz)! - Add identity merge suggestion commands for listing, inspecting, queueing, and rejecting suggested merges.

- [#146](https://github.com/OutlitAI/outlit-sdk/pull/146) [`ed59717`](https://github.com/OutlitAI/outlit-sdk/commit/ed597176dc6001e2e75810e32e413f07ec02a2a6) Thanks [@leo-paz](https://github.com/leo-paz)! - Validate integration setup progress responses and expose Gong/Mixpanel setup capability names.

- [#155](https://github.com/OutlitAI/outlit-sdk/pull/155) [`acdd743`](https://github.com/OutlitAI/outlit-sdk/commit/acdd7430b975f3f70b2274c8753f2721acc882a8) Thanks [@leo-paz](https://github.com/leo-paz)! - Add resource-first platform action CLI commands for agent create/update, automation create/update, signal create/update, and destination create/update.

- [#153](https://github.com/OutlitAI/outlit-sdk/pull/153) [`20c487b`](https://github.com/OutlitAI/outlit-sdk/commit/20c487bcb17cf7bbbf4c2548693b11beda1695fa) Thanks [@leo-paz](https://github.com/leo-paz)! - Add agent, automation, signal, and destination lifecycle commands for platform configuration actions.

- [#156](https://github.com/OutlitAI/outlit-sdk/pull/156) [`7021704`](https://github.com/OutlitAI/outlit-sdk/commit/7021704c3466784067d5b6934a4d5fe38b78d7eb) Thanks [@leo-paz](https://github.com/leo-paz)! - Add platform action CLI commands for workspace settings and automation run history.

- [#150](https://github.com/OutlitAI/outlit-sdk/pull/150) [`51b862d`](https://github.com/OutlitAI/outlit-sdk/commit/51b862d32ca2142da980ecde74add7f0f575a82a) Thanks [@leo-paz](https://github.com/leo-paz)! - Improve published README and package metadata citation surfaces with canonical docs, OpenAPI, MCP, and agent discovery links.

- [#158](https://github.com/OutlitAI/outlit-sdk/pull/158) [`aa07bfa`](https://github.com/OutlitAI/outlit-sdk/commit/aa07bfa1b89adcf569a5291db29cbb5cd76d6bda) Thanks [@leo-paz](https://github.com/leo-paz)! - Tighten destination update commands to the Slack-channel public contract.

- Updated dependencies [[`664e93c`](https://github.com/OutlitAI/outlit-sdk/commit/664e93cd8e1851f0183602ca07643b72a500ba35), [`fa7ba55`](https://github.com/OutlitAI/outlit-sdk/commit/fa7ba55868c73ed72b46ee7f320fab0423742d74), [`fe80b2f`](https://github.com/OutlitAI/outlit-sdk/commit/fe80b2f3532fbe9a8bf973f076134d5fca70917d), [`4ab015f`](https://github.com/OutlitAI/outlit-sdk/commit/4ab015f89e88aaf3dd2a618d86b5e4cc0cb0eafc), [`29ca464`](https://github.com/OutlitAI/outlit-sdk/commit/29ca4643c9c236a589eedfc348ca9fa031c2a966), [`51b862d`](https://github.com/OutlitAI/outlit-sdk/commit/51b862d32ca2142da980ecde74add7f0f575a82a), [`8693011`](https://github.com/OutlitAI/outlit-sdk/commit/8693011d63919b3ae7c6fa5bc1a3ea3b692b508e)]:
  - @outlit/tools@0.3.0

## 1.8.0

### Minor Changes

- [#133](https://github.com/OutlitAI/outlit-sdk/pull/133) [`dd67421`](https://github.com/OutlitAI/outlit-sdk/commit/dd674219d5b57ffb2717ac8d7b07031bfe7f81fd) Thanks [@leo-paz](https://github.com/leo-paz)! - Add browser-assisted CLI authentication for non-interactive agent shells.

## 1.7.1

### Patch Changes

- [#125](https://github.com/OutlitAI/outlit-sdk/pull/125) [`c488098`](https://github.com/OutlitAI/outlit-sdk/commit/c488098520191ee75dbfa8c61325393a4dd5ffbc) Thanks [@leo-paz](https://github.com/leo-paz)! - Add deterministic source listing CLI support and updated customer tool contracts.

- Updated dependencies [[`c488098`](https://github.com/OutlitAI/outlit-sdk/commit/c488098520191ee75dbfa8c61325393a4dd5ffbc)]:
  - @outlit/tools@0.2.1

## 1.7.0

### Minor Changes

- [#123](https://github.com/OutlitAI/outlit-sdk/pull/123) [`4e86cbb`](https://github.com/OutlitAI/outlit-sdk/commit/4e86cbb7af5f13e34654e132d7960f36bb3ffa7c) Thanks [@leo-paz](https://github.com/leo-paz)! - Add markdown notification bodies and explicit Slack destinations while keeping Slack as the default notifier.

### Patch Changes

- Updated dependencies [[`4e86cbb`](https://github.com/OutlitAI/outlit-sdk/commit/4e86cbb7af5f13e34654e132d7960f36bb3ffa7c)]:
  - @outlit/tools@0.2.0

## 1.6.4

### Patch Changes

- [#120](https://github.com/OutlitAI/outlit-sdk/pull/120) [`ad0340c`](https://github.com/OutlitAI/outlit-sdk/commit/ad0340c0974659ee5846460e9a5ff48579891f0a) Thanks [@leo-paz](https://github.com/leo-paz)! - Normalize customer context source type inputs case-insensitively so CRM, CRM_OPPORTUNITY, and OPPORTUNITY filters all resolve to the canonical OPPORTUNITY source type before CLI and SDK helper requests are sent.

- [#118](https://github.com/OutlitAI/outlit-sdk/pull/118) [`66353bb`](https://github.com/OutlitAI/outlit-sdk/commit/66353bb8771288a0c033056eefa8604b41464756) Thanks [@leo-paz](https://github.com/leo-paz)! - Fix customer inactivity parsing, integration status provider IDs, and CLI response normalization for stale sync rows and internal fact metadata.

- Updated dependencies [[`ad0340c`](https://github.com/OutlitAI/outlit-sdk/commit/ad0340c0974659ee5846460e9a5ff48579891f0a)]:
  - @outlit/tools@0.1.3

## 1.6.3

### Patch Changes

- [#110](https://github.com/OutlitAI/outlit-sdk/pull/110) [`85eeca2`](https://github.com/OutlitAI/outlit-sdk/commit/85eeca2f5c4ae3155665852c9294bf89ddbd36fb) Thanks [@leo-paz](https://github.com/leo-paz)! - Add OPPORTUNITY as the canonical CRM opportunity source type and accept CRM and CRM_OPPORTUNITY as input aliases.

- [#116](https://github.com/OutlitAI/outlit-sdk/pull/116) [`591dcaa`](https://github.com/OutlitAI/outlit-sdk/commit/591dcaa51cb8cee2d144de137f404b9a13cfd99a) Thanks [@leo-paz](https://github.com/leo-paz)! - Finish SDK-facing SQL view updates by aligning schema wording and example agent queries with public analytics views.

- [#115](https://github.com/OutlitAI/outlit-sdk/pull/115) [`842bbe8`](https://github.com/OutlitAI/outlit-sdk/commit/842bbe852b511dcabb50e610bfd13e69f99d8092) Thanks [@leo-paz](https://github.com/leo-paz)! - Update SQL tool contracts, CLI help, and Pi SQL guidance to use the public analytics views.

- [#117](https://github.com/OutlitAI/outlit-sdk/pull/117) [`dad1680`](https://github.com/OutlitAI/outlit-sdk/commit/dad168054587355d64ab50fec133cec005957627) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove backend-specific SQL wording from public analytics view guidance.

- Updated dependencies [[`d0dff81`](https://github.com/OutlitAI/outlit-sdk/commit/d0dff81fbc11c030b728ccf057601c8437e6215d), [`85eeca2`](https://github.com/OutlitAI/outlit-sdk/commit/85eeca2f5c4ae3155665852c9294bf89ddbd36fb), [`591dcaa`](https://github.com/OutlitAI/outlit-sdk/commit/591dcaa51cb8cee2d144de137f404b9a13cfd99a), [`842bbe8`](https://github.com/OutlitAI/outlit-sdk/commit/842bbe852b511dcabb50e610bfd13e69f99d8092), [`dad1680`](https://github.com/OutlitAI/outlit-sdk/commit/dad168054587355d64ab50fec133cec005957627)]:
  - @outlit/tools@0.1.2

## 1.6.2

### Patch Changes

- [#107](https://github.com/OutlitAI/outlit-sdk/pull/107) [`e6d0927`](https://github.com/OutlitAI/outlit-sdk/commit/e6d092704287a7e49b274e847d5afa87080111df) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the `outlit notify` command for sending Slack notifications from the CLI.

- Updated dependencies [[`7de9c83`](https://github.com/OutlitAI/outlit-sdk/commit/7de9c8358b0eb622c93487c1ddb6046446873c13), [`4548ed5`](https://github.com/OutlitAI/outlit-sdk/commit/4548ed5df90e1f3e99a3172b093b93b10c2fa0b7)]:
  - @outlit/tools@0.1.1

## 1.6.1

### Patch Changes

- [#105](https://github.com/OutlitAI/outlit-sdk/pull/105) [`fc51b27`](https://github.com/OutlitAI/outlit-sdk/commit/fc51b27ce89fe5309940ff276f72325c7329fa76) Thanks [@leo-paz](https://github.com/leo-paz)! - Fix the native CLI binary release by building local tool dependencies before release tests and avoiding top-level await in the CLI entrypoint.

## 1.6.0

### Minor Changes

- [#103](https://github.com/OutlitAI/outlit-sdk/pull/103) [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add public customer fact type and category filters, reject anomaly detector filters, and expand Pi growth-agent examples.

### Patch Changes

- [#98](https://github.com/OutlitAI/outlit-sdk/pull/98) [`e7f42ca`](https://github.com/OutlitAI/outlit-sdk/commit/e7f42ca89fe4e072f32e18969ae111ebd7979f59) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the public Outlit tools package and route CLI customer intelligence commands through it.

- [#102](https://github.com/OutlitAI/outlit-sdk/pull/102) [`cefc519`](https://github.com/OutlitAI/outlit-sdk/commit/cefc51938b57771b9ba3ebb45dbf541519964d7e) Thanks [@leo-paz](https://github.com/leo-paz)! - Update CLI help examples to use current journey stages and ISO datetime ranges.

- Updated dependencies [[`e7f42ca`](https://github.com/OutlitAI/outlit-sdk/commit/e7f42ca89fe4e072f32e18969ae111ebd7979f59), [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5)]:
  - @outlit/tools@0.1.0

## 1.5.0

### Minor Changes

- [#83](https://github.com/OutlitAI/outlit-sdk/pull/83) [`1038de4`](https://github.com/OutlitAI/outlit-sdk/commit/1038de4cd549b9105ed529680241a42bfb99bcd8) Thanks [@leo-paz](https://github.com/leo-paz)! - Add automatic CLI update notifications and a new `outlit upgrade` command.

- [#93](https://github.com/OutlitAI/outlit-sdk/pull/93) [`433121e`](https://github.com/OutlitAI/outlit-sdk/commit/433121e70858fbed8c90ce0747bc70173f5314bb) Thanks [@leo-paz](https://github.com/leo-paz)! - Refocus `outlit setup` on coding-agent skills, remove CLI-managed MCP setup subcommands, and add curated setup commands for Claude Code, Codex, Gemini CLI, Droid, OpenCode, and Pi.

### Patch Changes

- [#91](https://github.com/OutlitAI/outlit-sdk/pull/91) [`9cab5d1`](https://github.com/OutlitAI/outlit-sdk/commit/9cab5d17a08eeb0622ceb51957e8abb9be1a6340) Thanks [@leo-paz](https://github.com/leo-paz)! - Align CLI customer-surface commands with the shared tool contract registry and exact source lookup behavior.

- [#92](https://github.com/OutlitAI/outlit-sdk/pull/92) [`1d54582`](https://github.com/OutlitAI/outlit-sdk/commit/1d54582329b772447faf82eba799a17eb9a6090e) Thanks [@leo-paz](https://github.com/leo-paz)! - Align the CLI with the refactored customer context tool surface, including grouped search results, exact source retrieval, and split facts list/get commands.

- [#94](https://github.com/OutlitAI/outlit-sdk/pull/94) [`3943037`](https://github.com/OutlitAI/outlit-sdk/commit/394303767cc0deb905e2cc106ed9cba07b68acdc) Thanks [@leo-paz](https://github.com/leo-paz)! - Prevent `outlit setup` subcommands from falling through into the parent auto-detect installer when invoked through the CLI parser.

- [#95](https://github.com/OutlitAI/outlit-sdk/pull/95) [`8ac17c0`](https://github.com/OutlitAI/outlit-sdk/commit/8ac17c02088b50c704835991cfda072cb3e60a74) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `outlit setup openclaw` as a first-class setup alias for installing the Outlit skill into OpenClaw.

- [#89](https://github.com/OutlitAI/outlit-sdk/pull/89) [`6186f79`](https://github.com/OutlitAI/outlit-sdk/commit/6186f7929ab4adead38a3b10d23749ba11ed9a49) Thanks [@leo-paz](https://github.com/leo-paz)! - Use the dedicated API key validation endpoint in CLI auth flows and improve upgrade-path compatibility in CI.

## 1.4.1

### Patch Changes

- [#76](https://github.com/OutlitAI/outlit-sdk/pull/76) [`6ca230c`](https://github.com/OutlitAI/outlit-sdk/commit/6ca230c075b0b5274055745ddf60bc5b44653637) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: add PAST_DUE to billing status filter options in customers list command

- [#74](https://github.com/OutlitAI/outlit-sdk/pull/74) [`7e8aff5`](https://github.com/OutlitAI/outlit-sdk/commit/7e8aff5fd8f3fbb16af80c0b99b3c6d5c787ab4c) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Remove legacy ~/clawd/ skill path fallback and rename skill from outlit-intelligence to outlit

- [#77](https://github.com/OutlitAI/outlit-sdk/pull/77) [`507a8c3`](https://github.com/OutlitAI/outlit-sdk/commit/507a8c32e0d796013b34b46f413c648353842365) Thanks [@leo-paz](https://github.com/leo-paz)! - Add --doc-types, --source-types, --source-type, and --source-id flags to `outlit search`. Query is now optional when --source-type and --source-id are provided for direct source lookup.

## 1.4.0

### Minor Changes

- [#72](https://github.com/OutlitAI/outlit-sdk/pull/72) [`06bd548`](https://github.com/OutlitAI/outlit-sdk/commit/06bd54886a254b42ba76d354c401022abd9cc0c0) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add integrations commands (list, add, remove, status) with API-key and OAuth provider flows

## 1.3.1

### Patch Changes

- [#70](https://github.com/OutlitAI/outlit-sdk/pull/70) [`dbafc63`](https://github.com/OutlitAI/outlit-sdk/commit/dbafc63ca6e80302c52364c5f21257eb06b6511e) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: add PAST_DUE to billing status filter options in customers list command

## 1.3.0

### Minor Changes

- [#60](https://github.com/OutlitAI/outlit-sdk/pull/60) [`e0a2cf3`](https://github.com/OutlitAI/outlit-sdk/commit/e0a2cf3426bdf091e3df4cfa31c4acec8440ceb6) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Install outlit-sdk skill alongside outlit-cli, and auto-install skills during batch setup

## 1.2.0

### Minor Changes

- [#58](https://github.com/OutlitAI/outlit-sdk/pull/58) [`d856a8d`](https://github.com/OutlitAI/outlit-sdk/commit/d856a8d0d4b3b63dac2641a4efe300edc3333316) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `outlit setup skills` command to install the outlit-cli agent skill

## 1.1.0

### Minor Changes

- [#56](https://github.com/OutlitAI/outlit-sdk/pull/56) [`f435585`](https://github.com/OutlitAI/outlit-sdk/commit/f435585adc319efe1613b125ee570f6c408f5503) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `-v` short flag as alias for `--version`, fix table formatting, and fix CLI binary release pipeline.

## 1.0.1

### Patch Changes

- [#54](https://github.com/OutlitAI/outlit-sdk/pull/54) [`c0af82f`](https://github.com/OutlitAI/outlit-sdk/commit/c0af82fc667f6a6bfb73f7fa13df5b745e410730) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Rewrite shell completions with subcommand and flag support, fix Unicode encoding for npm package, add ASCII fallback for non-Unicode terminals.

- [`36ec301`](https://github.com/OutlitAI/outlit-sdk/commit/36ec301f74f9fd4f83466c5ac456d0cd16442f9b) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `-v` short flag as alias for `--version`.

## 1.0.0

### Major Changes

- [`8d97e72`](https://github.com/OutlitAI/outlit-sdk/commit/8d97e72da00c2ee3932814fb16b3fc6da82622a4) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Fix credential leak in MCP setup (suppress subprocess output that included Authorization header), use outputError for pagination failures, and improve test isolation.
