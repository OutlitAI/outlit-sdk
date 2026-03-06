# Outlit SDK

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
- Canary snapshots publish on every push to `main` when unreleased changesets exist
- Stable releases happen when the "Version Packages" PR is merged

## PR workflow

After pushing a PR, monitor it through to merge:

1. **Poll CI checks** (`gh pr checks`) until all required checks pass: Changeset Check, Lint/Build/Test, Rust CI
2. **Review AI comments** — CodeRabbit reviews PRs automatically. Pull down any inline comments (`gh api repos/OutlitAI/outlit-sdk/pulls/<number>/comments`) and review-level feedback (`gh api repos/OutlitAI/outlit-sdk/pulls/<number>/reviews`)
3. **Validate before fixing** — don't blindly apply AI suggestions. Check whether each comment is technically correct and relevant. Fix only what's valid; ignore or dismiss the rest
4. **Merge with rebase** when all checks are green and comments are resolved: `gh pr merge <number> --repo OutlitAI/outlit-sdk --rebase`

Non-required checks (e.g. Mintlify Deployment) can be skipped.

## Code style

- TypeScript everywhere
- Biome for formatting and linting (not eslint/prettier)
- No semicolons in most files (biome config)
- Prefer `bun` over `npm`/`npx` for running scripts
