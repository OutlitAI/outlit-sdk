# Company Activation CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class, test-covered CLI support for reading, historically previewing,
and explicitly configuring Core-derived company activation, plus customer activation
filtering and documentation.

**Architecture:** A focused activation contract/parser module validates CLI inputs and
produces one typed definition object. Four commands call centralized direct-client
operations and reuse existing auth, output, and error handling. The public customer tool
contract gains only the additive `activatedSince` filter.

**Tech Stack:** Bun 1.3.9, TypeScript, Citty, Bun test, Vitest, Biome, tsup, Changesets.

## Global Constraints

- Activation is company-grain, monotonic, and derived by Core.
- Compose one through three existing customer-grain signals with `ANY`, `ALL`, or
  `AT_LEAST`, plus an optional bounded window.
- Never add an authoritative SDK lifecycle mutation or synthetic activation-event helper.
- Never call or mutate live Outlit configuration in tests or development.
- Preserve CLI auth resolution, JSON conventions, exit codes, API-error formatting, and
  existing customer command behavior.
- Bind the exact Core routes: `GET /api/activation`,
  `POST /api/activation/preview`, and `PATCH /api/activation`.

---

### Task 1: Activation definition parser and command tests

**Files:**
- Create: `packages/cli/src/lib/activation.ts`
- Create: `packages/cli/tests/lib/activation.test.ts`
- Create: `packages/cli/tests/commands/activation.test.ts`

**Interfaces:**
- Produces `ActivationMatchMode`, `ActivationDefinitionInput`,
  `parseActivationDefinition(args, json)`, `parseActivationPreviewOptions(args, json)`,
  and activation operation-name constants.
- Command tests mock `createClient().callTool()` and assert exact typed parameters,
  pass-through JSON, preview routing, update/disable routing, local validation, and API
  errors.

- [ ] **Step 1: Write parser and command tests first**

Cover one `--signal`, comma-separated `--signals`, default single-signal `ANY`,
explicit `ANY`/`ALL`, valid `AT_LEAST`, duplicate removal, one-to-three bounds,
mutually exclusive signal flags, threshold rules, `168h`/`90d` window bounds, and
preview lookback/example bounds.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bun test packages/cli/tests/lib/activation.test.ts packages/cli/tests/commands/activation.test.ts
```

Expected: failure because the activation parser and commands do not exist.

- [ ] **Step 3: Implement the minimal typed parser**

The parser returns:

```ts
{
  signalIds: ["signal_1", "signal_2", "signal_3"],
  matchMode: "AT_LEAST",
  thresholdCount: 2,
  window: { value: 30, unit: "day" }
}
```

for `--signals signal_1,signal_2,signal_3 --match AT_LEAST --threshold 2 --window 30d`,
and exits through `outputError` before client creation for every invalid definition.

- [ ] **Step 4: Add `activation get`, `preview`, `update`, and `disable` commands**

Get sends `{}`; preview sends `{ definition, lookbackDays?, exampleLimit? }`; update
sends `{ definition }`; disable sends `{ definition: null }`. All four use
`getClientOrExit` and `runTool`, preserving raw successful response JSON.

- [ ] **Step 5: Rerun focused tests and verify GREEN**

Run the same focused Bun test command and require zero failures.

### Task 2: Direct client routing and customer filtering

**Files:**
- Modify: `packages/cli/src/lib/client.ts`
- Modify: `packages/cli/tests/lib/client.test.ts`
- Modify: `packages/cli/src/commands/customers/list.ts`
- Modify: `packages/cli/tests/commands/customers/list.test.ts`
- Modify: `packages/tools/src/contracts.ts`
- Modify: `packages/tools/tests/client.test.ts`

**Interfaces:**
- Consumes activation operation-name constants from Task 1.
- Produces the Core-confirmed authenticated route bindings.
- Adds `activatedSince: string` to `outlit_list_customers` input schema and request
  parameters without changing any existing optional fields.

- [ ] **Step 1: Add failing route and filter tests**

Assert get uses `GET /api/activation`, preview uses
`POST /api/activation/preview`, update and disable use `PATCH /api/activation`,
structured API errors survive unchanged, valid ISO timestamps map to `activatedSince`,
and invalid values exit before `callTool`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
bun test packages/cli/tests/lib/client.test.ts packages/cli/tests/commands/customers/list.test.ts
bun run test
```

Run the second command from `packages/tools`. Expected: new assertions fail because the
bindings and schema property are absent.

- [ ] **Step 3: Implement centralized bindings and additive filter**

Add only the three Core-confirmed route mappings. Validate ISO-8601 input locally and
pass it unchanged as `activatedSince`.

- [ ] **Step 4: Build tools and verify GREEN**

```bash
bun run build
bun run test
bun test packages/cli/tests/lib/client.test.ts packages/cli/tests/commands/customers/list.test.ts
```

Run the first two commands from `packages/tools`; run the third from the repository root.

### Task 3: Routing, help, completions, docs, and release note

**Files:**
- Create: `packages/cli/src/commands/activation/index.ts`
- Create: `packages/cli/src/commands/activation/get.ts`
- Create: `packages/cli/src/commands/activation/preview.ts`
- Create: `packages/cli/src/commands/activation/update.ts`
- Create: `packages/cli/src/commands/activation/disable.ts`
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/src/commands/completions.ts`
- Modify: `packages/cli/tests/commands/completions.test.ts`
- Modify: `docs/cli/commands.mdx`
- Modify: `docs/cli/overview.mdx`
- Modify: `docs/concepts/customer-journey.mdx`
- Modify: `docs/concepts/customer-context-graph.mdx`
- Create: `.changeset/company-activation-cli.md`

**Interfaces:**
- Exposes the top-level `activation` command with `get`, `preview`, `update`, and
  `disable`.
- Documents `activatedAt` in customer JSON and `activated_at` in analytics where
  confirmed by Core.

- [ ] **Step 1: Add failing completion and routing assertions**

Assert all three shells offer `activation`, its subcommands, every definition flag,
preview lookback/example flags, the separate disable command, and `customers list
--activated-since`.

- [ ] **Step 2: Run completion tests and verify RED**

```bash
bun test packages/cli/tests/commands/completions.test.ts packages/cli/tests/commands/activation.test.ts
```

- [ ] **Step 3: Wire commands and update user-facing documentation**

Explain that company activation is distinct from contact journey stages, derived from
ordinary events through existing customer-grain signals, monotonic, and previewable
without mutation. Include single-signal and `AT_LEAST` examples.

- [ ] **Step 4: Add a minor changeset for `@outlit/cli` and `@outlit/tools`**

The summary names the activation CLI and additive customer filter.

### Task 4: Validate, review, reconcile, and publish

**Files:**
- Inspect all files in `git diff origin/main...HEAD` and the working tree.

**Interfaces:**
- Consumes the exact Core PR contract.
- Produces a pushed SDK branch and draft PR that names the Core dependency.

- [ ] **Step 1: Reconcile the client map and shared field names with Core**

Compare route paths, methods, request keys, response keys, `activatedSince`,
`activatedAt`, and analytics `activated_at` against the Core implementation and tests.
Notify the coordinating task immediately if any public shape diverges.

- [ ] **Step 2: Run focused and package-level verification**

```bash
bun test packages/cli/tests/lib/activation.test.ts packages/cli/tests/commands/activation.test.ts packages/cli/tests/commands/customers/list.test.ts packages/cli/tests/lib/client.test.ts packages/cli/tests/commands/completions.test.ts
bun run test
bun run typecheck
bun run build
bun run lint
```

Run package scripts from their applicable package or repository root and record exact
results.

- [ ] **Step 3: Run fresh-context review**

Use distinct product/contract, correctness/security, and test/documentation lenses. Fix
all valid Critical and Important findings, rerun affected verification, and perform a
focused fix-diff review if material changes were required.

- [ ] **Step 4: Commit, push, and open a draft PR**

Stage intentional files explicitly, commit with a focused message, push
`codex/company-activation-cli`, and open a draft PR against `main`. Include the Core PR
dependency, compatibility notes, and exact validation commands/results.
