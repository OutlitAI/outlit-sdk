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

1. Open the SDK companion with contracts regenerated from the Core PR. Finish its ordinary SDK
   checks and review; **Core Contract Merge Order** may remain red until Core merges.
2. In the Core PR, set `.github/sdk-contract-source.json` to `{ "commit": "<full SDK commit SHA>" }`.
   Core's required **SDK Tool Contract Drift** regenerates and compares both files byte-for-byte.
   It reads the SDK commit as data; it never executes SDK PR code. Keep the pin when no contract
   changes are needed. A companion rebase alone does not invalidate accepted files.
3. Merge Core through its normal checks and queue. Then recheck the SDK guard:
   `gh workflow run core-contract-guard.yml --repo OutlitAI/outlit-sdk --ref main -f pr=<number>`.
   Adding/removing a label also requests a recheck; no label overrides a mismatch.
4. Merge the SDK companion only after the guard and all ordinary checks pass. If another Core
   contract update landed first, regenerate and coordinate its exact pin; do not bypass the guard.
5. Promote Core normally and verify the relevant production surface. Only then approve the
   Version Packages PR, after its exact-head checks and release review.

Core PR checks use the checked-in SDK commit, not moving SDK main. This removes the mismatch
window for unrelated Core PRs. The SDK status proves that Core main accepted the files at the
reported check time; it is not a production receipt or permission to publish stable SDK packages.
Core can advance again after a check. That does not change the pinned evidence used by Core CI.

### Guard activation (maintainer setup)

Land Core's immutable-pin/check change first, bootstrapped with artifacts matching Core main.
Then land this SDK guard and configure `CORE_CONTRACTS_READ_TOKEN`: a dedicated fine-grained token
with **Contents: read** on **OutlitAI/Core only** (or equivalent repository-scoped read credential).
Do not reuse a publishing/admin token. The SDK token is scoped to this repo's status writes.

Require the **Core Contract Merge Order** commit status from GitHub Actions in the SDK `main`
ruleset, alongside existing checks. Until that setting and credential are configured, this PR
alone does not enforce merge order. No repository settings or credentials are changed by this PR.
SDK merge queues are not supported by this guard or the current SDK CI; do not enable a queue
without adding trusted synthetic-head checks. Core's existing merge queue remains supported.

The privileged guard runs trusted SDK-base code via `pull_request_target`, or manual dispatch
from `main`. It never checks out, installs or executes SDK PR code, and never downloads Core
source. It compares the two generated file blob identities with Core's pinned SDK revision.
Missing credentials/evidence and API failures block changed contracts. Edits are detected against
the PR merge base, so unrelated older branches do not need private Core access. Each evaluation posts pending before success/failure on the captured
PR head; a canceled or timed-out evaluation remains pending. A stale event cannot approve a new
head. Re-run the trusted guard if Core or the SDK PR changes during verification.
