# Outlit docs skill sync implementation report

## Implemented

- `docs/skill.md` is a custom Mintlify root override generated from `OutlitAI/skills` `skills/outlit/SKILL.md` at upstream `main` SHA `4a3045c9a1eefff79fb1d83bb7c9673467358dce`. Frontmatter and prose are unchanged; the two relative reference link targets are rewritten to immutable raw GitHub URLs at that **same SHA**.
- `docs/skill-source.json` records the repository, pinned revision, and SHA-256 digests of `SKILL.md`, `references/identity.md`, and `references/sql-reference.md`. The reference URLs returned HTTP 200 during fetch, and `--check` verifies their exact bytes against the manifest.
- `scripts/sync-outlit-skill.mjs` offers `--sync`, `--check`, and `--check-latest`. It resolves the upstream `main` SHA before fetching immutable paths, rejects missing/unsafe or removed required reference links, rejects unsupported relative inline/definition links in the skill **and fetched reference Markdown**, scopes the `outlit` name check to YAML frontmatter, and leaves the committed pin untouched when a newer upstream commit has identical skill/reference bytes. `--check` compares the committed artifact with the pinned upstream source; `--check-latest` additionally detects content drift on upstream `main`.
- `.github/workflows/sync-outlit-skill.yml` runs every six hours or by manual dispatch on SDK `main`, with fixed-branch concurrency and job-scoped write permissions. It uses the default `GITHUB_TOKEN` and `peter-evans/create-pull-request` to open/update a review PR containing only the generated skill and manifest when content changes. No auto-merge or direct push to protected `main`. `.github/workflows/ci.yml` checks the pinned artifact on ordinary PR CI.
- `tests/docs/skill-sync.test.mjs` tests source-preserving transformation, same-revision reference URLs/digests, unrelated-commit no-churn behavior, missing/unsafe references, unsupported relative links (including reference definitions and nested links in fetched reference Markdown), frontmatter scope, and changed-reference detection. `docs/.mintignore` excludes the provenance manifest from publication. `docs/README.md` documents refresh, human CI trigger/review, and deployment lag. The CLI install source and setup flow were not edited.

## Verification on this worktree

- `node scripts/sync-outlit-skill.mjs --sync`: generated from `4a3045c9...`; second run reported **unchanged**.
- `node scripts/sync-outlit-skill.mjs --check` and `--check-latest`: both passed against the pinned revision and current upstream `main`.
- `bunx vitest run tests/docs`: **52 tests passed** across seven files, including ten skill sync tests. The original tests and review-driven cases were observed failing before the implementation and passing afterward.
- `bunx --bun mint validate` from `docs/`: **build validation passed**.
- `node --check scripts/sync-outlit-skill.mjs`, YAML parse of new workflow, and `git diff --check`: passed.
- An earlier `bun run lint` exited 0, but Biome emitted internal panics on generated `packages/*/dist` files while package lint scripts used `--write`. It did not change tracked package files. This result is **not** evidence of a clean repository lint, and broad lint was not rerun. Focused `bunx biome check docs/skill-source.json` passed; `.mjs` files are outside the current Biome includes, so their targeted evidence is `node --check` plus the behavior tests.

## Deployment and remaining limits

- The root override is supported by [Mintlify's current skill.md documentation](https://www.mintlify.com/docs/ai/skillmd); local `mint validate` does not exercise hosted `/.well-known/skills/*` discovery or installation. After a reviewed merge and Mintlify deploy, verify `/skill.md`, both well-known indexes/skill bodies, and a real `skills add https://docs.outlit.ai` install that can fetch the two pinned reference URLs. No deploy or real PR was performed in this task.
- The scheduled workflow's `GITHUB_TOKEN` PR updates do not trigger `pull_request` workflows. A maintainer must remove and re-add its `skip-changelog` label to run required CI before review/merge. Repo Actions settings must allow PR creation.
- Freshness is bounded by schedule/dispatch, PR review/merge, Mintlify deployment, and cache propagation. The existing GitHub skill installer can use the canonical upstream bundle immediately.
- Root independently verified a `skills@1.5.13` GitHub-repository install with the current skill and both reference files matching canonical hashes. That covers the GitHub path, not the hosted docs path.
- Existing unrelated uncommitted documentation work was preserved. No commit, push, PR, server, or external write was made.

Research decision artifact: `/tmp/du-skill-sync-options.md`.
