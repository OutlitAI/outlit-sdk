# Shared Contact and Company Activation CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework SDK #164 so the existing exact activation event can be read, historically
previewed, updated, or disabled while preserving customer activation filtering and typed
results.

**Architecture:** A focused activation module validates one event name and bounded preview
options, then types the three existing direct Core routes. Four CLI commands reuse the
existing auth, output, and error boundaries. Customer `activatedSince`, nullable
`activatedAt`, and analytics `activated_at` remain unchanged.

**Tech Stack:** Bun 1.3.9, TypeScript, Citty, Bun test, Biome, tsup, Changesets, OpenAPI.

## Global Constraints

- `TrackingPixelConfig.activationEvent` is the single activation setting.
- The exact matching ordinary product event applies to both contacts and their resolved
  company.
- Activation timestamps are monotonic and are never cleared or moved by configuration.
- Preview is historical and read-only.
- Configuration updates are prospective and do not backfill history.
- Do not add a public SDK lifecycle method or a synthetic activation event.
- Preserve CLI auth resolution, stable JSON envelopes, error formatting, and exit codes.
- Keep customer `activatedSince`, nullable `activatedAt`, and analytics `activated_at`.
- Bind only `GET /api/activation`, `POST /api/activation/preview`, and
  `PATCH /api/activation`.
- Keep SDK #164 draft; do not merge or stably release it.

---

### Task 1: Lock the replacement CLI contract with failing tests

**Files:**
- Modify: `packages/cli/tests/lib/activation.test.ts`
- Modify: `packages/cli/tests/commands/activation.test.ts`
- Modify: `packages/cli/tests/lib/client.test.ts`
- Modify: `packages/cli/tests/commands/completions.test.ts`

**Interfaces:**
- Produces expected inputs `{ eventName, lookbackDays?, exampleLimit? }` and
  `{ eventName: string | null }`.
- Produces expected activation output
  `{ eventName, behavior: "first_matching_product_event", appliesTo: ["contact", "company"] }`.
- Preserves literal `runTool` consumers for static Core route-drift discovery.

- [ ] **Step 1: Replace parser tests with exact event-name tests**

Assert `parseActivationEvent({ event: " integration_connected " }, true)` returns
`"integration_connected"`. Assert missing, blank, and 192-character names fail before client
creation. Keep preview-bound tests for 1..90 and 1..20.

- [ ] **Step 2: Replace command tests with the new request bodies**

Assert:

```ts
preview -> {
  eventName: "integration_connected",
  lookbackDays: 45,
  exampleLimit: 12,
}
update -> { eventName: "integration_connected" }
disable -> { eventName: null }
```

Assert preview never calls the update tool, successful envelopes pass through unchanged,
and API failures retain the existing structured error behavior.

- [ ] **Step 3: Replace typed-client route assertions**

Call all four flows through `OutlitClient.callTool()` and assert GET has no body, preview
uses the exact POST body, and update/disable use the exact PATCH bodies.

- [ ] **Step 4: Replace completion assertions**

Assert preview and update offer only `--event` from the activation-specific flags, preview
also offers `--lookback-days` and `--example-limit`, and disable offers no setting flags.

- [ ] **Step 5: Run focused tests and verify RED**

Run:

```bash
bun test \
  packages/cli/tests/lib/activation.test.ts \
  packages/cli/tests/commands/activation.test.ts \
  packages/cli/tests/lib/client.test.ts \
  packages/cli/tests/commands/completions.test.ts
```

Expected: failures show the current implementation still accepts definition-shaped input
and emits definition-shaped request bodies.

---

### Task 2: Implement the minimal typed event-name CLI

**Files:**
- Replace: `packages/cli/src/lib/activation.ts`
- Modify: `packages/cli/src/lib/client.ts`
- Modify: `packages/cli/src/commands/activation/index.ts`
- Modify: `packages/cli/src/commands/activation/get.ts`
- Modify: `packages/cli/src/commands/activation/preview.ts`
- Modify: `packages/cli/src/commands/activation/update.ts`
- Modify: `packages/cli/src/commands/activation/disable.ts`
- Modify: `packages/cli/src/commands/completions.ts`
- Modify: `packages/cli/src/cli.ts`

**Interfaces:**
- Produces `ActivationState`, `ActivationPreviewInput`, `ActivationUpdateInput`,
  `ActivationPreviewResult`, and their platform-envelope response aliases.
- Produces `activationEventArg`, `parseActivationEvent(args, json)`, and
  `parseActivationPreviewOptions(args, json)`.

- [ ] **Step 1: Replace the activation module**

Define:

```ts
interface ActivationState {
  eventName: string | null
  behavior: "first_matching_product_event"
  appliesTo: ["contact", "company"]
}

interface ActivationPreviewInput {
  eventName: string
  lookbackDays?: number
  exampleLimit?: number
}

interface ActivationUpdateInput {
  eventName: string | null
}
```

The preview example is:

```ts
{
  customer: { id: string; name: string; domain: string }
  activatedAt: string | null
  firstMatchedAt: string
  eventId: string
}
```

- [ ] **Step 2: Implement local validation**

Trim `--event`, require at least one character, reject more than 191 characters, and retain
bounded integer parsing for preview options. Use existing `missing_input` and
`invalid_input` output paths.

- [ ] **Step 3: Update the four commands**

Get sends `{}`. Preview sends `{ eventName, ...options }`. Update sends `{ eventName }`.
Disable sends `{ eventName: null }`. All commands keep `getClientOrExit`, `runTool`, and
literal activation tool names.

- [ ] **Step 4: Update help and completions**

Explain that the same exact ordinary product event activates contacts and companies, Core
sets timestamps once, preview is read-only, and disable preserves historical timestamps.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 1 command and require zero failures.

---

### Task 3: Rewrite public contracts and documentation

**Files:**
- Modify: `docs/openapi.json`
- Modify: `docs/cli/commands.mdx`
- Modify: `docs/cli/overview.mdx`
- Modify: `docs/concepts/customer-journey.mdx`
- Modify: `docs/concepts/customer-context-graph.mdx`
- Modify: `.changeset/company-activation-cli.md`
- Modify: `docs/superpowers/specs/2026-07-28-company-activation-cli-design.md`
- Modify: `docs/superpowers/plans/2026-07-28-company-activation-cli.md`

**Interfaces:**
- Consumes Core's final strict request/response schemas.
- Produces an SDK OpenAPI document byte-for-byte suitable for Core's critical-contract
  fixture.

- [ ] **Step 1: Confirm Core's implemented final schema**

Verify strict request objects, required fields, response nullability, preview example shape,
final Core SHA, and whether the customer tool-contract hash changed. Report any divergence
before editing generated contract artifacts.

- [ ] **Step 2: Replace activation OpenAPI operations and schemas**

Document:

```json
GET data.activation:
{"eventName":null,"behavior":"first_matching_product_event","appliesTo":["contact","company"]}

POST body:
{"eventName":"integration_connected","lookbackDays":30,"exampleLimit":10}

PATCH body:
{"eventName":"integration_connected"}
```

Keep the standard command envelopes and existing error responses. Remove every obsolete
activation-definition schema and reference.

- [ ] **Step 3: Rewrite help and conceptual documentation**

Use only exact-event terminology. Explain shared contact/company behavior, monotonic
timestamps, prospective configuration, read-only preview, ordinary event tracking,
customer filtering, and analytics exposure.

- [ ] **Step 4: Update the changeset**

Describe the event-name activation get/preview/update/disable CLI and the additive customer
activation fields/filter without promising Core availability before deployment.

- [ ] **Step 5: Scan for obsolete activation terminology**

Run a scoped search across activation source, tests, docs, OpenAPI schemas, plan, changeset,
and PR text. Any composition-oriented activation field or flag is a failure.

---

### Task 4: Reconcile, verify, review, and prepare the draft PR

**Files:**
- Inspect: every file in `git diff origin/main...HEAD`
- Update: GitHub draft PR #164 title and body

**Interfaces:**
- Consumes the final Core #1663 head and unchanged drift scripts. SDK #164 depends on Core
  #1663 for the routes and runtime behavior.
- Produces a pushed SDK branch with current validation evidence and no live mutations.

- [ ] **Step 1: Run focused and package validation**

```bash
cd packages/cli
bun run test
bun run typecheck
bun run build
cd ../tools
bun run test
bun run typecheck
bun run build
cd ../..
bun run lint
bun run typecheck
bun run build
```

- [ ] **Step 2: Run all three Core drift scripts**

Run Core's exact tool-contract, OpenAPI, and CLI-route drift commands against the final Core
and SDK heads. Record the tool-contract hash, OpenAPI hash, and endpoint/consumer counts.

- [ ] **Step 3: Inspect and review the full diff**

Check request keys, response keys, direct routes, no-mutation preview behavior, auth/error
reuse, customer compatibility, docs, OpenAPI, and removal of obsolete activation language.
Resolve every valid Critical or Important finding and rerun affected validation.

- [ ] **Step 4: Commit and push intentional files**

Stage only intentional SDK files, inspect the staged diff, commit the replacement contract,
and push `codex/company-activation-cli`.

- [ ] **Step 5: Rewrite and monitor draft PR #164**

Update the title and body to the shared exact-event contract and link Core #1663. State the
verified order exactly: merge SDK #164 first so Core's drift workflow can validate SDK
`main`, then merge Core #1663. Activation commands must not be used until Core is deployed,
and stable Changesets publication remains on hold until that deployment. List fresh checks,
keep the PR draft, and watch required CI and CodeRabbit; do not merge or publish.
