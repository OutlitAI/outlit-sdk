# SDK stable release coordination

SDK `main` is the source-development branch. Merging a feature PR with a changeset updates the
bot-authored **Version Packages** PR and may publish `canary` snapshots, but it does not publish a
stable npm version, stable CDN asset, or CLI binary.

The Version Packages PR is the stable release boundary. Merging it causes the next `main` push to
build and publish the versions recorded in that PR.

## Ordinary stable release

1. Confirm the Version Packages PR is bot-authored from `changeset-release/main` into `main`.
2. Confirm its package versions and changelog entries match the intended release.
3. Run CI on the exact latest release head:
   - add the existing `skip-changelog` label when it is absent; or
   - after the bot updates an already-labeled PR, remove and re-add `skip-changelog`.
4. Wait for **Changeset Check**, **Lint, Build & Test**, and **Rust CI** to pass on that head.
5. Merge the Version Packages PR as the explicit stable-release action.
6. Monitor the resulting Release workflow, npm publication, CLI binary release when applicable,
   and stable CDN update when applicable.

Never bypass missing or stale release-head checks merely because the contributing feature PRs
were green.

## Core-dependent contract release

When SDK tools, CLI behavior, generated contracts, or OpenAPI depend on an unshipped Core change:

1. Validate the coordinated Core and SDK feature heads locally or in their normal PR checks.
2. Merge the SDK source PR first. This lets Core's required drift check consume SDK `main`; it
   still does not publish a stable SDK release.
3. Rerun Core's drift check, merge the coordinated Core PR, and promote that exact Core commit to
   production through Core's normal release workflow.
4. Verify the relevant Core production surface before approving SDK publication.
5. Refresh and validate the Version Packages PR at its exact latest head, then merge it.

If Core cannot be promoted safely, leave the Version Packages PR open. Do not work around the
ordering with a drift-check bypass or by publishing stable SDK packages from a feature branch.
