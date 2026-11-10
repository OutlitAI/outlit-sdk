---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
---

The admin tools move to the Agent API v2 shapes: 25 tools become 16, with previews, undo and retry keys. This ships in the same release as the customer and context tools (`customer-tools-v2`, `context-tools-v2`), so there is one major bump. Each retired name and input spelling keeps answering through the gateway until 2026-12-11, then is refused with the new name; `@outlit/tools`, the CLI and Pi expose only the new names.

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
