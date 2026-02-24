# Outlit CLI — Test Report

> **Date:** 2026-02-23
> **Version:** 0.1.0
> **Runtime:** Bun 1.3.9
> **Platform:** macOS Darwin 24.6.0 (ARM64)

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tests** | 147 |
| **Passed** | 147 |
| **Failed** | 0 |
| **Expect calls** | 386 |
| **Test files** | 29 |
| **Execution time** | ~188ms |
| **TypeScript check** | Pass (0 errors) |
| **Build (npm)** | Pass (149.33 KB bundle) |

**Result: ALL TESTS PASSING**

---

## Test Coverage by Module

### Commands — Authentication (4 files)

| Test File | Status | Description |
|-----------|--------|-------------|
| `auth/login.test.ts` | PASS | Interactive login, `--key` flag, key validation, file storage, JSON output |
| `auth/logout.test.ts` | PASS | Credential removal, idempotent behavior, env var warning |
| `auth/status.test.ts` | PASS | Auth state checking, API validation, masked key output |
| `auth/whoami.test.ts` | PASS | Masked key printing, source detection, JSON output |

### Commands — Customers (3 files)

| Test File | Status | Description |
|-----------|--------|-------------|
| `customers/list.test.ts` | PASS | Filtering (billing status, activity, MRR), pagination, table rendering |
| `customers/get.test.ts` | PASS | Lookup by ID/domain/name, `--include` flag, timeframe |
| `customers/timeline.test.ts` | PASS | Channel filtering, event types, date ranges, timeframe vs explicit dates |

### Commands — Users (1 file)

| Test File | Status | Description |
|-----------|--------|-------------|
| `users/list.test.ts` | PASS | Journey stage filtering, customer scoping, pagination, search |

### Commands — Intelligence (3 files)

| Test File | Status | Description |
|-----------|--------|-------------|
| `facts.test.ts` | PASS | Customer facts retrieval, timeframe handling |
| `search.test.ts` | PASS | Semantic search, customer scoping, top-k, date filtering |
| `sql.test.ts` | PASS | Query execution, `--query-file`, row limits |

### Commands — Diagnostics & Utilities (4 files)

| Test File | Status | Description |
|-----------|--------|-------------|
| `doctor.test.ts` | PASS | Version check, API key validation, connectivity, agent detection |
| `schema.test.ts` | PASS | Full schema listing, per-table columns |
| `completions.test.ts` | PASS | Bash/zsh/fish script generation |
| `api.test.ts` | PASS | Tool invocation, error handling, output modes |

### Commands — Setup / AI Agents (7 files)

| Test File | Status | Description |
|-----------|--------|-------------|
| `setup/auto-detect.test.ts` | PASS | Agent detection logic (Cursor, Claude, VS Code, Gemini, OpenClaw) |
| `setup/claude-code.test.ts` | PASS | Claude Code MCP registration via CLI |
| `setup/claude-desktop.test.ts` | PASS | Claude Desktop config file merging |
| `setup/cursor.test.ts` | PASS | Cursor MCP config merging |
| `setup/vscode.test.ts` | PASS | VS Code project-local MCP config |
| `setup/gemini.test.ts` | PASS | Gemini CLI MCP registration |
| `setup/openclaw.test.ts` | PASS | OpenClaw skill file creation |

### Library Utilities (7 files)

| Test File | Status | Description |
|-----------|--------|-------------|
| `lib/client.test.ts` | PASS | API client creation, endpoint mapping, key validation |
| `lib/config.test.ts` | PASS | Credential resolution (flag > env > file), key masking, paths |
| `lib/format.test.ts` | PASS | `formatCents`, `relativeDate`, `truncate` |
| `lib/output.test.ts` | PASS | JSON output, error output, exit codes |
| `lib/spinner.test.ts` | PASS | Braille animation, TTY detection, non-interactive no-op |
| `lib/table.test.ts` | PASS | Box-drawing table rendering, column alignment |
| `lib/tty.test.ts` | PASS | Interactive detection (pipe, CI, TERM=dumb) |

---

## Build Verification

| Build Target | Status | Output |
|--------------|--------|--------|
| npm bundle (`bun build --target node`) | PASS | `dist/cli.js` (149.33 KB) |
| Type check (`tsc --noEmit`) | PASS | 0 errors |

### Cross-platform binaries (build:all)

| Target | Binary | Status |
|--------|--------|--------|
| macOS ARM64 | `dist/outlit-darwin-arm64` | Defined |
| macOS x64 | `dist/outlit-darwin-x64` | Defined |
| Linux x64 | `dist/outlit-linux-x64` | Defined |
| Linux ARM64 | `dist/outlit-linux-arm64` | Defined |
| Windows x64 | `dist/outlit-windows-x64.exe` | Defined |

> Cross-platform binaries are compiled via `bun build --compile` targeting each platform. Full cross-compilation requires CI (GitHub Actions).

---

## CLI Smoke Tests

| Command | Status | Notes |
|---------|--------|-------|
| `outlit --help` | PASS | Displays all 10 top-level commands |
| `outlit auth --help` | PASS | Shows 4 auth subcommands |
| `outlit customers --help` | PASS | Shows list/get/timeline subcommands |
| `outlit users --help` | PASS | Shows list subcommand |
| `outlit facts --help` | PASS | Positional customer arg, timeframe flag |
| `outlit search --help` | PASS | Positional query arg, customer/top-k/date flags |
| `outlit sql --help` | PASS | Positional query, query-file flag |
| `outlit schema --help` | PASS | Optional table arg |
| `outlit doctor --help` | PASS | Diagnostics with JSON output |
| `outlit completions --help` | PASS | Shell arg (bash/zsh/fish) |
| `outlit setup --help` | PASS | Shows 6 agent subcommands + --yes flag |

---

## Release Workflow

| Check | Status | Notes |
|-------|--------|-------|
| Working directory paths | FIXED | Changed `apps/cli` → `packages/cli` (7 occurrences) |
| Release asset paths | FIXED | Changed `apps/cli/dist/` → `packages/cli/dist/` (5 occurrences) |
| Bun version | OK | `1.3.0` specified in workflow |
| Node version | OK | `22` specified for npm publish |
| Binary verification | OK | Checks all 5 platform binaries exist and are non-empty |
| Archive packaging | OK | tar.gz for Unix, zip for Windows |
| npm publish | OK | `--access public` with `NPM_TOKEN` secret |
| GitHub Release | OK | Auto-generated notes + install instructions |
| Homebrew tap | OK | Dispatches to `OutlitAI/homebrew-tap` |

---

## Issues Found & Fixed

### Critical: Workflow path mismatch
- **File:** `.github/workflows/release-cli.yml`
- **Problem:** All `working-directory` values and release asset paths referenced `apps/cli` instead of `packages/cli`
- **Impact:** The entire release pipeline would fail on CI — install, test, build, publish, and release asset upload
- **Fix:** Replaced all 12 occurrences of `apps/cli` with `packages/cli`

---

## Test Architecture Notes

- **Framework:** Bun's native test runner (`bun:test`)
- **Mocking:** `mock.module()` for client/config injection; `spyOn` for stdout/stderr capture
- **Error handling:** Custom `ExitError` class to capture `process.exit()` calls without terminating
- **Environment isolation:** `useTempEnv()` helper creates temp directories and auto-cleans env vars
- **TTY simulation:** `setInteractive()` / `setNonInteractive()` helpers for output mode testing
- **Security:** Test API keys are generated at runtime to avoid Gitleaks false positives
