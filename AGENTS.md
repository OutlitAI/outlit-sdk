# Outlit SDK

## Agent workflow

- Follow the user's requested outcome through implementation and relevant verification when they ask for a change. A request to review or explain stays read-only unless it also authorizes fixes. Reuse decisions and authorization already given in the conversation.
- Inspect discoverable facts and make routine, reversible implementation choices. Ask only for unresolved decisions that materially affect scope, behavior, risk, or external actions; continue independent authorized work while waiting. Prepare a concrete result before seeking any remaining release approval.
- Use skills that materially help the task. These repository workflow rules take precedence over generic skill process defaults, subject to system/developer instructions and the user's request. Skill discovery, a planning template, or a finishing menu must not create an extra approval gate. If a skill blocks progress, cite its exact file and instruction and explain the unresolved requirement.
- Scale planning to the work. Use a short internal plan for a clear change; write a durable plan for meaningful sequencing, contracts, migrations, or long work. An authorized implementation task continues after planning. Keep changes cohesive and preserve unrelated work; add abstractions only for a current requirement or demonstrated consumer.
- When delegation is available and permitted by the session, use bounded specialists for independent work that benefits from parallel execution or fresh review. Keep one lead responsible for integration and final evidence. Give writers separate ownership and reviewers distinct questions. Reuse passing checks and stop review when requested risks are covered; repeat only for relevant changes or unresolved findings.
- Match verification to the claim. Use relevant tests and required CI for code; inspect or render documentation, copy, and visual changes as appropriate. Do not add tests that only restate the edit or repeat passing checks on unchanged inputs. Keep product-specific security, data, and release gates.
- Report the outcome, evidence, and remaining limits concisely. Identify the checked revision and environment when they matter. For long reviews, save detailed findings to a linked artifact. A running server, empty screen, queued job, or green build alone does not prove a requested user flow or deployment succeeded.

Monorepo for Outlit's TypeScript tracking SDKs (`@outlit/core`, `@outlit/browser`, `@outlit/node`) and CLI (`@outlit/cli`).

## Tech stack

- **Runtime**: Bun (v1.3.9, set via `packageManager` in root `package.json`)
- **Build**: Turbo + tsup
- **Linting/formatting**: Biome
- **Testing**: Vitest (unit), Playwright (browser e2e)
- **Releases**: Changesets (`@changesets/cli`) — stable releases and canary snapshots via GitHub Actions
- **Rust crate** (`crates/outlit`): released separately via `release-plz`

## Project structure

```
packages/
  core/       # Shared types and utilities (dependency of browser + node)
  browser/    # Browser SDK with React and Vue bindings
  node/       # Node.js server-side SDK
  cli/        # CLI tool (Rust binary published via npm)
  typescript-config/  # Shared tsconfig
```

## Common commands

```bash
bun install              # Install deps
bun run build            # Build all packages (turbo)
bun run test             # Run all tests
bun run typecheck        # Type-check all packages
bun run lint             # Lint with biome
bun run changeset        # Create a changeset for your changes
```

## Publishing rules

**Never use `workspace:*` (or any `workspace:` protocol) in `dependencies` of published packages.** Use concrete version ranges (e.g. `"^1.1.0"`) instead. `devDependencies` may use `workspace:*` since they are excluded from published tarballs.

**Why**: Changesets uses `npm publish` under the hood (even in bun workspaces). `npm publish` does not resolve the `workspace:` protocol, so it leaks verbatim into the published tarball and breaks consumers — especially those using bun workspaces.

Bun workspaces resolve any matching version range to the local package, so concrete ranges like `"^1.1.0"` work identically to `workspace:*` during local development. Changesets' `updateInternalDependencies: "patch"` setting keeps these ranges in sync when dependency versions are bumped.

## Changesets

- Config: `.changeset/config.json`
- `@outlit/core`, `@outlit/browser`, and `@outlit/node` are **linked** — they version together
- `updateInternalDependencies: "patch"` — changesets updates internal dep ranges on any bump
- Canary snapshots publish on every push to `main` when unreleased changesets exist. Canary
  publication does not update stable npm tags, stable CDN assets, or CLI binaries.
- Stable releases happen only when the bot-authored "Version Packages" PR is merged. Treat that
  merge as the production release button, not as routine repository maintenance.
- Before merging the Version Packages PR, run CI on its exact latest head by adding the existing
  `skip-changelog` label (or removing and re-adding it after a bot update), wait for `Changeset
  Check`, `Lint, Build & Test`, and `Rust CI`, then review the final package/version list.
- For contracts coordinated with Core, use this order: merge the SDK source PR to `main`, merge
  and promote the matching Core change to production, verify Core production, and only then merge
  the Version Packages PR. Do not publish the stable SDK merely because SDK `main` or a canary is
  green.
- Keep Core's default SDK-main drift validation fail-closed. Do not replace this release order
  with mutable counterpart branches or a bypass of either repository's normal drift checks.

See `docs/release-coordination.md` for the maintainer checklist.

## PR workflow

After an authorized PR push, monitor CI and review feedback through the requested handoff:

1. **Poll CI checks** (`gh pr checks`) until all required checks pass: `Changeset Check`, `Lint, Build & Test`, `Rust CI`
2. **Review AI comments** — CodeRabbit reviews PRs automatically. Pull down any inline comments (`gh api repos/OutlitAI/outlit-sdk/pulls/<number>/comments`) and review-level feedback (`gh api repos/OutlitAI/outlit-sdk/pulls/<number>/reviews`)
3. **Validate before fixing** — don't blindly apply AI suggestions. Check whether each comment is technically correct and relevant. Fix only what's valid; ignore or dismiss the rest
4. **When the user has authorized merging**, merge with rebase after all required checks pass and valid review findings are resolved: `gh pr merge <number> --repo OutlitAI/outlit-sdk --rebase`

Non-required checks (e.g. Mintlify Deployment) can be skipped.

## Code style

- TypeScript everywhere
- Biome for formatting and linting (not eslint/prettier)
- No semicolons in most files (biome config)
- Prefer `bun` over `npm`/`npx` for running scripts
