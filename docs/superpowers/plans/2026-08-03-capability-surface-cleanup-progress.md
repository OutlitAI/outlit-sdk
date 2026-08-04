# Capability Surface Cleanup — SDK Progress

Last updated: 2026-08-04

## Coordination

- SDK branch: `codex/capability-surface-cleanup`
- SDK base: fresh `origin/main` at `4009499`
- Core worktree: `/Users/leopaz/.codex/worktrees/1662/Core`
- Core generator revision: `c48e0579687799ea943f7a9d8dd843a39603b43d`
- Original Core cleanup checkpoint: `44f946200db58ee7a0c4aac7b91dfc4f4ccd29d4`

## Implemented companion surface

- Core generates `packages/tools/src/generated/contracts.ts` as data only and `docs/openapi.json` as the canonical public OpenAPI document.
- Generated public OpenAPI gateway security documents direct API-key bearer authentication only; delegated OAuth remains an MCP-to-Platform transport detail rather than a public SDK authentication mode.
- The generated payload contains 29 exact public tool contracts, `default`/`analytical`/`cli` memberships, the manifest-owned public OpenAPI transport projection, tool-gateway and API-key-validation transports, the exact gateway error codes/schema, the ingest method/path/event set plus request/response schemas, shared customer enums, and contract hash `734deec7fc9b275e2366edaa43384c13806616c6562f54332ff3fe22f692a59c`.
- `@outlit/tools` keeps runtime guards, source-type normalization, search-input normalization, result typing, and URL/request execution hand-authored. It no longer owns capability names, descriptions, schemas, memberships, or gateway paths.
- Pi consumes Core's default membership and exposes the generated default, analytical, and complete public sets.
- Every retained authored CLI capability calls the tool gateway. The direct endpoint map is deleted.
- Integration setup supports only catalog-declared browser handoff and setup/sync status. Direct credentials, provider configuration, setup steps, provider allowlists, report settings, destination options, and disconnect are absent; the web UI is the human control plane.
- Core/browser/node derive the ingestion URL, method, and TypeScript event union from generated ingest data. Rust consumes an SDK-generated Rust projection with an exact drift check.
- Public tracking declarations and Rust types exclude rejected stage and billing lifecycle APIs.
- The breaking Changeset covers tools, CLI, Pi, core, browser, and node; Rust remains release-plz managed.

## Verification contract

- Regenerate Core artifacts:
  `OUTLIT_SDK_REPO=/Users/leopaz/.codex/worktrees/c0f4/outlit-sdk bun scripts/generate-tool-contracts-for-sdk.ts`
- Check Core drift:
  `OUTLIT_SDK_REPO=/Users/leopaz/.codex/worktrees/c0f4/outlit-sdk bun scripts/check-sdk-tool-contract-drift.ts`
  and `OUTLIT_SDK_REPO=... bun scripts/check-sdk-openapi-drift.ts`
- Generate/check Rust projection: `bun run contracts:generate` and `bun run contracts:check`.
- Generated `contracts.ts` and `docs/openapi.json` are never hand-edited or formatted by SDK tooling.

## Completion status

- Core contract and OpenAPI drift checks pass against `c48e0579687799ea943f7a9d8dd843a39603b43d`.
- Changed-file Biome, the focused capability/docs suite, full workspace typecheck/build/test, generated Rust drift, `cargo fmt`, `cargo clippy -D warnings`, and the full Rust test/doc-test suite pass.
- No missing Core fixture or generator artifact remains. The companion is ready as committed SDK slices; it has not been pushed or opened as a pull request.
