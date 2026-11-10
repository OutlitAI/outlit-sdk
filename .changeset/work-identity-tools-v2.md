---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
---

The work and identity tools move to the Agent API v2 shapes. This ships in the same release as the customer and context tools (`customer-tools-v2`, `context-tools-v2`), so there is one major bump. Nine tools change; their commands are unchanged. Core maps the old tool names and input spellings until 2026-12-11, and the old outputs are gone.

**Tool renames** (the default-toolset and Pi entries change with them):

| Was | Is |
|---|---|
| `outlit_list_inbox` | `outlit_list_tasks` |
| `outlit_get_inbox_item` | `outlit_get_task` |
| `outlit_act_on_inbox_item` | `outlit_act_on_task` |
| `outlit_undo_inbox_action` | `outlit_undo_task_action` |
| `outlit_get_customer_identity` | `outlit_get_identity` |
| `outlit_list_identity_merge_suggestions` | `outlit_list_merge_suggestions` |
| `outlit_reject_identity_merge_suggestion` | `outlit_reject_merge_suggestion` |
| `outlit_get_customer_merge_status` | `outlit_get_merge` |
| `outlit_merge_customers` | same name, new input and output |

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
