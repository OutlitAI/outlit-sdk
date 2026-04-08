# CLI Update Notifications Design

## Goal

Add developer-friendly CLI update notifications during normal interactive use without adding telemetry and without slowing down commands.

## Scope

- Automatic update notifications only
- No telemetry collection
- Reuse the existing npm registry version lookup already present in `outlit doctor`

## Product Behavior

The CLI should surface update availability during regular interactive usage, not only through `outlit doctor`.
The notification should be lightweight and non-blocking:

- Show only in interactive TTY usage
- Never show in JSON mode, CI, tests, or piped/non-interactive output
- Use cached state so the CLI does not hit the npm registry on every run
- Refresh the cache at most once every 12 hours

When a cached update is known, the CLI should print a short notice to `stderr` and continue running normally.

## UX

The message should be compact and actionable. It should include:

- Current installed version
- Newer available version
- A recommended upgrade command

The upgrade command should try to match the user's installer when possible. If install method inference is not possible, the CLI should fall back to a generic update hint rather than making a bad guess.

## Technical Approach

Add a small helper module inside `packages/cli/src/lib/update.ts` that owns:

- Reading and writing a local update cache in the Outlit config directory
- Deciding whether a fresh check is due
- Fetching the latest published version from the npm registry
- Formatting the update notice and upgrade command
- Guarding interactive vs non-interactive contexts

The normal CLI startup flow should:

1. Check whether update notifications are allowed in the current context
2. Read cached update state
3. Print a notice if a newer version is already known
4. Trigger a background refresh when the cache is stale

To avoid impacting short-lived commands, the refresh should run in a detached subprocess rather than a best-effort in-process fetch.

## Failure Handling

- Missing or corrupted cache files should be ignored silently
- Registry failures should not print errors during normal command runs
- Failed checks should only remain visible through `outlit doctor`
- A simple environment-variable kill switch should disable update notifications entirely

## Testing

Tests should cover:

- Cache freshness decisions
- Cache read/write and corrupted cache fallback
- Update notice visibility rules
- Upgrade command inference
- `doctor` reuse of the shared version-check helper

## Success Criteria

- No telemetry added
- No measurable startup regression for common commands
- No extra output in machine-readable flows
- Interactive users are told when a newer CLI version exists
