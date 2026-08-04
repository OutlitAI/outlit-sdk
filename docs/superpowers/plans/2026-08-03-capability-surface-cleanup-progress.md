# Capability Surface Cleanup — SDK Progress

Last updated: 2026-08-03

## Coordination

- SDK branch: `codex/capability-surface-cleanup`
- SDK base: fresh `origin/main` at `4009499`
- Core worktree: `/Users/leopaz/.codex/worktrees/1662/Core`
- Core revision last inspected: `b71c1038f51a40033316256ffc69cfe32f26e9db`
- Original coordination checkpoint: `44f946200db58ee7a0c4aac7b91dfc4f4ccd29d4`

## Completed SDK slices

- `3d7e3ec` narrows `@outlit/tools` and Pi to Core's exact 12-tool public catalog, removes the notification/action exports, and adds exact-set/runtime rejection coverage.
- `d99f229` removes public CLI agent, automation, signal, identity-suggestion, and notification commands, direct endpoint bindings, completion entries, modules, and obsolete tests while retaining authored destinations/settings UX.
- The working tree syncs `docs/openapi.json` to Core's narrowed 21-path SDK fixture, removes retired documentation, and converts Pi growth examples to return structured findings without external notification actions.
- Tracking coverage verifies TypeScript source unions, built declarations for core/browser/node, the OpenAPI ingest union, and the Rust event enum do not expose `stage` or `billing` event APIs. The implementation removal itself was already released on SDK `main` before this companion branch.
- A breaking Changeset covers `@outlit/tools`, `@outlit/cli`, and `@outlit/pi`.

## Verification completed

- Core `check-sdk-tool-contract-drift.ts`: pass; hash `b9ca81d1ec676dfbfa2ac72f8ef69946355504298b283050d7c161d06b9923cb`
- Core `check-sdk-openapi-drift.ts`: pass
- Core legacy `check-sdk-cli-route-drift.ts`: pass; 22 endpoints / 22 consumers
- CLI typecheck/build: pass
- CLI CI test split: 35 + 304 tests pass
- Tools build/test/typecheck: pass
- Pi build/test/typecheck: pass
- Pi growth-agent package: 46 tests and typecheck pass
- Core package build/test/typecheck: pass; 48 tests pass
- Root build: pass
- Root typecheck/build/test: pass
- Docs contract tests: 26 tests pass
- Changed TypeScript/TSX Biome check: 19 files pass
- Rust format, Clippy, unit/integration/compatibility/doc tests: pass; 52 tests pass
- Public-surface repository searches and `git diff --check`: pass

## Exact Core artifact dependency

The current Core generator still emits only `sdkToolContractPayload` plus the contract hash, and templates hand-authored helper logic into `packages/tools/src/contracts.ts`. Core does **not yet emit** the plan-required:

1. generated-file header and data-only module,
2. public gateway endpoint metadata,
3. Core-owned named `default` and `analytical` CLI/Pi policy subsets,
4. capability/REST bindings for authored CLI commands, or
5. canonical browser/Node/Rust ingestion endpoint constants.

Core also still owns `scripts/sdk-cli-routes.ts` and parses the SDK's `CLI_TOOL_ENDPOINTS` literal. Therefore the final planned cleanup—deleting `CLI_TOOL_ENDPOINTS` and replacing locally selected Pi toolsets with generated Core projections—cannot be implemented exactly until those fields are exported by Core. When available, regenerate `packages/tools/src/contracts.ts`, move stable helpers back to hand-authored source, bind CLI/Pi to the generated projections, add the reciprocal Core/SDK revision pin, and rerun all drift checks.
