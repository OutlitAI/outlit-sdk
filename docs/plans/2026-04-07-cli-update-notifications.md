# CLI Update Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cached, developer-friendly update notifications to the CLI during normal interactive use without adding telemetry or slowing command execution.

**Architecture:** Add a focused update helper in the CLI package that owns npm version fetching, cache persistence, context guards, and notice formatting. Reuse that helper from both `src/cli.ts` for normal interactive notifications and `src/commands/doctor.ts` for explicit diagnostics so version-check behavior stays consistent.

**Tech Stack:** Bun, TypeScript, Bun test, citty, Node fs/path/os/process APIs

### Task 1: Document and test update helper behavior

**Files:**
- Create: `packages/cli/tests/lib/update.test.ts`
- Modify: `packages/cli/tests/helpers.ts`

**Step 1: Write the failing test**

Write tests for:

- stale cache detection after 12 hours
- corrupted cache returning empty state
- newer version detection
- upgrade command inference
- notification eligibility guards

**Step 2: Run test to verify it fails**

Run: `bun test packages/cli/tests/lib/update.test.ts`
Expected: FAIL because `../../src/lib/update` does not exist yet.

**Step 3: Write minimal implementation**

Create `packages/cli/src/lib/update.ts` with:

- cache file path resolution
- cache read/write helpers
- `isUpdateCheckDue`
- `compareVersions`
- `shouldNotifyAboutUpdate`
- installer command inference
- registry fetch helper shared by `doctor`

**Step 4: Run test to verify it passes**

Run: `bun test packages/cli/tests/lib/update.test.ts`
Expected: PASS.

### Task 2: Add CLI-level notification behavior

**Files:**
- Modify: `packages/cli/src/cli.ts`
- Test: `packages/cli/tests/commands/update-notifier.test.ts`

**Step 1: Write the failing test**

Add tests that verify:

- cached update notices print in interactive mode
- no notice in non-interactive mode
- no notice in JSON/piped scenarios
- stale cache causes background refresh to be scheduled without blocking

**Step 2: Run test to verify it fails**

Run: `bun test packages/cli/tests/commands/update-notifier.test.ts`
Expected: FAIL because the CLI does not notify or schedule refreshes yet.

**Step 3: Write minimal implementation**

Update `src/cli.ts` to:

- read cached update state before `runMain(main)`
- print a short `stderr` notice when appropriate
- spawn a detached internal update-check process when cache is stale
- respect `OUTLIT_NO_UPDATE_NOTIFIER`, CI, tests, and non-TTY contexts

**Step 4: Run test to verify it passes**

Run: `bun test packages/cli/tests/commands/update-notifier.test.ts`
Expected: PASS.

### Task 3: Reuse the shared version helper in doctor

**Files:**
- Modify: `packages/cli/src/commands/doctor.ts`
- Modify: `packages/cli/tests/commands/doctor.test.ts`

**Step 1: Write the failing test**

Extend doctor tests to verify the shared version helper still reports:

- `pass` when current is latest
- `warn` when newer version exists
- `warn` when lookup fails

**Step 2: Run test to verify it fails**

Run: `bun test packages/cli/tests/commands/doctor.test.ts`
Expected: FAIL if `doctor` still uses duplicated logic or old update command wording.

**Step 3: Write minimal implementation**

Refactor `doctor.ts` to call the new shared registry helper and shared upgrade-command formatter.

**Step 4: Run test to verify it passes**

Run: `bun test packages/cli/tests/commands/doctor.test.ts`
Expected: PASS.

### Task 4: Run focused verification

**Files:**
- Test: `packages/cli/tests/lib/update.test.ts`
- Test: `packages/cli/tests/commands/update-notifier.test.ts`
- Test: `packages/cli/tests/commands/doctor.test.ts`

**Step 1: Run targeted tests**

Run: `bun test packages/cli/tests/lib/update.test.ts packages/cli/tests/commands/update-notifier.test.ts packages/cli/tests/commands/doctor.test.ts`
Expected: PASS.

**Step 2: Run package test suite if the focused tests pass cleanly**

Run: `bun test` in `packages/cli`
Expected: PASS.

**Step 3: Review output for regressions**

Confirm there is no stray stdout/stderr noise and no flaky timing assumptions in tests.
