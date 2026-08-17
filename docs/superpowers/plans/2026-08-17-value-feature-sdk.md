# Value Feature SDK Implementation Plan

**Goal:** Expose Core's additive Value Feature contracts through the generated tools client, Pi/MCP, and a small product-facing CLI.
**Source:** Core's `2026-08-17-customer-feature-usage-mvp.md` plan, the generated contract hash `70d31c1aca711a65f296b7ae62a3281f8ac92853a308fea2ada58dd4feedfd1f`, and the coordinated SDK request.
**Approach:** Keep Core-generated contracts and OpenAPI authoritative, add hand-authored result aliases and CLI adapters around the four generated tool names, and leave existing commands unchanged.
**Scope:** Workspace taxonomy/evidence read, single-rule create, non-final archive, and authorized customer feature-usage read. Archive is the only self-service lifecycle action in the MVP.
**Key risks:** SDK code must not diverge from Core schemas or consumer policies; the CLI must preserve exact event names; archive must require the opaque current revision; unavailable evidence must remain distinct from zero usage.
**Completion:** Focused tools, CLI, Pi/MCP, docs, typecheck, lint, build, generated drift, and local smoke checks pass; fresh review has no unresolved Critical or Important findings; the PR to `main` is green on its latest head without being merged.

## File and Contract Map

- `packages/tools/src/generated/contracts.ts` and `docs/openapi.json`: Core-generated source of truth; never hand-edit.
- `packages/tools/src/results.ts` and `packages/tools/src/index.ts`: ergonomic result aliases derived from generated output schemas.
- `packages/cli/src/commands/value-features/*`: workspace, create, and archive adapters.
- `packages/cli/src/commands/customers/feature-usage.ts`: customer-scoped usage read.
- `packages/cli/src/cli.ts` and `packages/cli/src/commands/completions.ts`: command registration and discoverability.
- `packages/pi`, `docs/api-reference`, `docs/ai-integrations`, and `docs/cli`: agent/MCP and human documentation.

## 1. Generated Contract Projection

**Contracts:** The exact tool names are `outlit_get_value_feature_workspace`, `outlit_create_value_feature`, `outlit_archive_value_feature`, and `outlit_get_customer_feature_usage`. Core owns their schemas and places all four in the `pi` and `cli` consumer policies only.

- Add result aliases derived from `PublicToolResult` rather than duplicating shapes.
- Extend tools and Pi tests to cover the four generated capabilities while verifying that the default and analytical policies remain unchanged.
- Report any generated schema or policy mismatch back to Core instead of compensating locally.

**Verification:** `bun test packages/tools/tests/client.test.ts` and `bun test packages/pi/tests/extension.test.ts`.

## 2. Product-Facing CLI

**Contracts:** Add `outlit value-features workspace`, `create`, and `archive`; add `outlit customers feature-usage <customer>`. Keep exact event names untrimmed, validate bounded week/candidate inputs locally, default property filters to an empty array, and require both feature ID and revision for archive.

- Write command tests first and confirm they fail because modules/routes are absent.
- Implement only the generated inputs and the archive-only MVP lifecycle.
- Extend shell completions and command help with the same names and bounds.

**Verification:** focused CLI command, completion, routing, and public-surface tests plus direct `--help` smoke commands.

## 3. Documentation, Review, and PR

- Document the CLI operations and API/MCP tool catalogue without claiming Core is deployed.
- Add a changeset for the affected public packages.
- Run Core's tool-contract and OpenAPI drift checks against this SDK worktree.
- Run distinct fresh-context reviews for product/contract correctness and CLI/test/compatibility risk; fix validated Critical and Important findings.
- Rebase onto current `origin/main`, verify the exact rebased head, commit intentionally, push the `codex/` branch, open a PR to `main`, and monitor CI plus CodeRabbit without merging.

**Complete when:** the latest PR head has passing required checks, review findings are resolved or explicitly rebutted, and the handoff records exact Core dependency, SDK base/head SHAs, commands, and PR URL.
