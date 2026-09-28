# Outlit maintained skill: independent review (Opus 5.5, read-only)

Phase 1 is the design review against the in-progress code, dated 2026-09-27. Phase 2 (the implementation delta) is complete; see the end of this file.

## Inputs checked

- SDK worktree `docs/documentation-update` (uncommitted): `scripts/sync-outlit-skill.mjs` and `tests/docs/skill-sync.test.mjs`. `docs/skill.md`, `docs/skill-source.json` and the refresh workflow don't exist yet.
- Upstream `OutlitAI/skills` `main` = `4a3045c9a1eefff79fb1d83bb7c9673467358dce` (from `git ls-remote`). Fetched `skills/outlit/{SKILL.md,references/identity.md,references/sql-reference.md}` at that SHA and all returned 200. `SKILL.md` is byte-identical to the stale local checkout `9d4c1c8`. Its only relative links are the two `](references/…)` links on lines 119 and 162. The reference files contain no relative links.
- `github.com/OutlitAI/outlit-agent-skills` returns a 301 to `OutlitAI/skills`. `ls-remote` and raw URLs under the old name resolve to the same SHA. The CLI (`packages/cli/src/commands/setup/skills.ts:7`) and docs install commands can stay unchanged.
- Live docs: `/.well-known/skills/index.json` lists the Mintlify-generated `outlit` with `files:["SKILL.md"]`. `/.well-known/agent-skills/index.json` has a Mintlify-computed `digest`.
- Marketing worktree: `src/lib/first-party-skills.ts` is pinned to `1382b1c…`. It serves the SKILL.md body verbatim, so relative links resolve to `https://www.outlit.ai/.well-known/skills/outlit/references/identity.md`, which I confirmed returns **404** live. That confirms the reference 404 the marketing writer is fixing.

## Design findings

### Important

**I1: A pinned SHA is not proven to be on `main`.** Refs: `sync-outlit-skill.mjs` `--check`/`upstreamSnapshot`, and the raw URL built in `buildSnapshot`.
- `--check` accepts any 40-hex `revision` that `raw.githubusercontent.com/OutlitAI/skills/<sha>` serves. GitHub shares objects across a fork network, so a commit that exists only in a fork (or on an unmerged branch) is fetchable under the `OutlitAI/skills` URL.
- Scenario: a PR hand-edits `docs/skill-source.json` to such a SHA and regenerates. `--check` passes. The published docs skill then sends agents to reference files under an `OutlitAI/skills` URL that is not canonical content. The refresh path (`ls-remote main`) is fine; only the check has this gap.
- Fix: in `--check`, verify the revision is an ancestor of `refs/heads/main`. For example, do a blob-less `git fetch` of `main` and run `git merge-base --is-ancestor <rev> FETCH_HEAD`. This is scoped to the claimed integrity property, not a broad hardening item.
- Verdict: plausible. The fork-object behavior is documented publicly, but I did not reproduce it here.
- **Disposition (root, 2026-09-27): not accepted as a required change.** The manifest is reviewed, `--sync` pins only from `ls-remote main`, and there is no contract for untrusted manifests. The extra clone/ancestry network step is avoided. Residual risk, recorded here: a manually edited `revision` in a PR relies on reviewer inspection alone. Closed for this review.

**I2: The rewrite is fail-closed only for `references/…` links. Other relative links pass through silently.**
- Only `](references/…)` is detected. None of these fail: `](./references/x.md)`, `](agents/openai.yaml)`, `](../outlit-sdk/SKILL.md)`, or reference-style definitions such as `[id]: references/identity.md`. Each would ship as a relative link on docs.outlit.ai and 404 (the same failure marketing is fixing now).
- Fix: after the transform, fail on any Markdown link or definition target that is not `http(s):`, `mailto:` or `#…`. Link title syntax and fragments already throw via the path regex, which is acceptable fail-closed behavior.
- Minor side effect: the regex also rewrites `](references/…)` inside fenced code blocks. There are none today.

**I3: The refresh PR won't get the required CI if it is opened with `GITHUB_TOKEN`.** This applies to the workflow, which isn't written yet.
- `ci.yml` runs on `pull_request` (opened/synchronize/labeled). GitHub does not start workflows for PRs, pushes or labels created with `GITHUB_TOKEN`. The bot PR would therefore sit without the required `Changeset Check` and `Lint, Build & Test` checks, and adding `skip-changelog` from the same token doesn't help.
- Choose one of these and document it:
  - (a) a GitHub App or fine-grained token, scoped to this repo, with contents and pull-requests write;
  - (b) accept `GITHUB_TOKEN`, and have a maintainer close and reopen the PR or push to it to start CI.
- In either case the repo setting "Allow GitHub Actions to create and approve pull requests" must be on, or PR creation fails.
- Other rules for the workflow:
  - Use one fixed bot branch and update it in place (`--force-with-lease`) rather than opening duplicate PRs.
  - Add a `concurrency` group.
  - Grant permissions at job level only (`contents: write`, `pull-requests: write`).
  - Use `schedule` + `workflow_dispatch` only, with no `pull_request_target`.
  - Fail visibly when the network or upstream fetch fails, and never open an empty PR.
- Changeset Check: a diff touching only `docs/` should pass `changeset status --since=origin/main` because no workspace package changes. Confirm this on the first real PR rather than adding the label automatically.

**I4: The repo hash is not the served hash, and Mintlify's verbatim serving is unproven.**
- The manifest proves that the committed `docs/skill.md` equals transform(upstream@SHA). It does not prove what Mintlify serves. The current generated skill shows Mintlify adds or re-serializes frontmatter (`metadata.mintlify-proj`).
- The canonical frontmatter has nested `metadata.openclaw` YAML with flow sequences and an emoji. Mintlify might re-serialize it, and could even treat `skill.md` as a page.
- Preview gate:
  - Fetch `/skill.md` and compare it to `docs/skill.md` bytes, or document the exact difference Mintlify introduces.
  - Check that `/.well-known/skills/index.json` shows name `outlit`, the canonical description and `files:["SKILL.md"]`.
  - Check that the `/.well-known/agent-skills/index.json` `digest` equals the sha256 of the served body.
  - Run `npx skills add <preview URL>` to confirm the skill installs under the name `outlit`.
- Any docs copy or PR text that says "identical to canonical" must be scoped to what this gate verified.

### Minor

**M1: Name collision is by design, but the three sources ship different bytes.** _Superseded by P2-M4 in Phase 2._
- GitHub (CLI), docs.outlit.ai and www.outlit.ai all publish `outlit`, and installers write to the same `…/skills/outlit/` directory, so the last install wins.
- The copies differ:
  - GitHub copy: relative links plus local `references/`.
  - Docs and marketing copies: absolute raw links, and `files:["SKILL.md"]`, so there are no local references.
  - Revisions can differ too. SDK `--sync` intentionally keeps an older revision when contents match, while marketing pins `4a3045c`.
- Consequences:
  - Digests are not comparable across sources.
  - Agents installed from the docs URL need network access to read the references. Sandboxed or offline agents lose them, whereas GitHub installs keep them.
- Acceptable. Just don't claim cross-source byte identity. The prose line "Use the `outlit-sdk` skill instead" names a skill that the docs index won't list. This is unchanged behavior and needs no action.

**M2: `--check` needs network access.** It fetches from raw.githubusercontent.com. If it is wired into required CI, a GitHub raw outage fails unrelated PRs. That is acceptable, but `--check-latest` must **never** be in required PR CI, because it would fail every PR whenever upstream moves. Keep it in the scheduled job only.

**M3: `docs/skill-source.json` sits inside the Mintlify root.** It may be published as a static file. That is harmless, but it is unintended unless the provenance is meant to be public. Add it to `docs/.mintignore` or move it outside `docs/`. Never ignore `skill.md`.

**M4: SDK docs contract tests will scan the generated file.** `tests/docs/public-examples.test.ts:37-49` includes every tracked `docs/**/*.md`. That covers `--channels` legacy values and TS/JSON fence validity across all public docs.
- The canonical content passes today: there is no `--channels`, and the fences are bash and text only.
- An upstream change could still fail the bot PR. The rule should be to fix upstream and never edit the snapshot. Keep the scan as a useful cross-check, or explicitly exclude the generated file. Either is fine if it is stated.

**M5: The frontmatter check isn't scoped.** `/^name: outlit\s*$/m` matches anywhere in the file, not only in the frontmatter. It is low risk.

**M6: Freshness wording.** The event-driven path is unavailable: cross-repo pushes can't trigger SDK workflows without a `repository_dispatch` token in the skills repo. Scheduled runs can also be delayed or dropped under GitHub load.
- Correct claim: "refreshed by a reviewed PR after the scheduled check detects upstream changes; live after merge and Mintlify deploy."
- Avoid "always latest", "mirrors main" and "real-time".

### What looks right

- The rewrite targets only immutable same-SHA raw URLs. The prose and frontmatter bytes are otherwise preserved, as the test asserts.
- The digest covers every rewritten reference, so reference-only upstream changes trigger a refresh (tested).
- The script uses `ls-remote`, not the stale local checkout.
- It decodes strictly with UTF-8 `fatal`.
- There are no CLI or source-skill behavior changes.

## Phase 2: implementation delta (final, 2026-09-27)

Reviewed working trees (uncommitted) at these paths:
- SDK: `/home/leo/.herdr/worktrees/outlit-sdk/docs-documentation-update`
- Marketing: `/home/leo/.herdr/worktrees/marketing/docs-agent-discovery-consistency`

Both are based on upstream `OutlitAI/skills@4a3045c`. I ran nothing that writes and executed no workflows. The only command I executed was the network-read `node scripts/sync-outlit-skill.mjs --check`. I also read the installer source for `skills@1.5.13` from the local bun cache (`dist/cli.mjs`, `WellKnownProvider`).

### Important

**P2-I1 (marketing): `skills add https://www.outlit.ai` installs `SKILL.md` without its references, so the hosted files don't reach installed copies.**
- `createFirstPartySkillsIndexResponse` backs both `/.well-known/agent-skills/index.json` and `/.well-known/skills/index.json`.
- It emits `$schema: …/discovery/0.2.0/schema.json` with `type: "skill-md"`.
- How `skills@1.5.13` handles this:
  - It tries `.well-known/agent-skills` first (`WELL_KNOWN_PATHS`, `cli.mjs:2346`).
  - For a v2 index it ignores `files` and, for `skill-md`, fetches only `url`, checks the digest and stores just `SKILL.md` (`fetchArtifactSkillByEntry`, `cli.mjs:2566-2598`).
  - Only the v1 legacy index (no `$schema`, `files: string[]`) downloads extra files (`cli.mjs:2542-2562`), and it is never reached because v2 succeeds first.
- Result: the installed `outlit/SKILL.md` keeps `](references/identity.md)` and `](references/sql-reference.md)`, which point at files missing from the install directory.
- The new `[...path]` route fixes the live 404 for agents that fetch over HTTP. It doesn't fix installed copies.
- Choose one:
  - (a) publish the `outlit` entry as v2 `type: "archive"`, a deterministic tar/zip of the pinned bundle with its digest;
  - (b) accept `SKILL.md`-only installs and say so in the index `syncPolicy` or README. The GitHub/CLI install path stays the complete one.
- Don't claim "full bundle via the domain installer" until an isolated `skills add https://www.outlit.ai --skill outlit` shows both references on disk.

**P2-I2 (marketing): the README freshness claim contradicts the workflow schedule.**
- `README.md` says "The scheduled workflow runs every six hours", but `.github/workflows/first-party-skill-refresh.yml` uses `cron: "17 13 * * 1"`, which is weekly on Mondays.
- Fix either the cron (to match the SDK's `17 */6 * * *`) or the text.
- Bound for the final rollout step: an upstream merge can take up to about a week plus review before marketing refreshes on schedule. Use `workflow_dispatch` for the planned post-merge refresh.

### Minor

**P2-M1 (marketing):** the hand-maintained index `description` for `outlit` ("customer context … account owners …") differs from the canonical frontmatter ("customer intelligence … workspace users … identity splits, merge suggestions, integrations").
- The installer uses the frontmatter (`createSkill` from `parseFrontmatter`), so installs are correct. Only the discovery listing is stale, and sync never refreshes it.
- This predates the change. Either derive the description from the pinned frontmatter or accept the drift.

**P2-M2 (marketing):** `sync-first-party-skills.mjs` resolves `main` through the unauthenticated `api.github.com/repos/…/commits/main`.
- Hosted runners share IP-based limits, so this can hit 403s. The workflow then fails visibly with no PR, which is fail-closed.
- Options: `git ls-remote` (as the SDK uses) or `GITHUB_TOKEN` in the header.
- The workflow also lacks a `concurrency` group and sets permissions at workflow level rather than job level. Low impact, since it's schedule and dispatch only.

**P2-M3 (SDK): the I4 hosted gate is written as post-deploy only** (`docs/README.md`, "Check the hosted `/skill.md` …after deployment").
- The PR that introduces the skill replaces a working generated skill. Run the gate on this PR's Mintlify preview before merge:
  - Compare `/skill.md` to the `docs/skill.md` bytes.
  - Check `/.well-known/agent-skills/index.json`: name `outlit`, and a `digest` equal to the sha256 of the served body.
  - Run `skills add <preview>` in isolation.
- Why the digest step matters: skills@1.5.13 tries this v2 index first and silently returns no skill on a digest mismatch (`cli.mjs:2570`).

**P2-M4 (all sources): M1 restated for the final design.** Every source installs into the same `outlit` directory, so the last install wins.

| Install source | What lands on disk | References |
| --- | --- | --- |
| GitHub / CLI (`outlit setup`) | `SKILL.md` + `references/*` | Local; root verified exact hashes |
| docs.outlit.ai (Mintlify) | `SKILL.md` only | Absolute raw URLs pinned to the SHA, readable with network |
| www.outlit.ai (v2 `skill-md`) | `SKILL.md` only | Relative, unresolved (P2-I1) |

- Digests are comparable where the bytes match: marketing and the upstream `SKILL.md` digest are both `sha256:11a92cda…`. Docs has different bytes because of the rewrite.
- Don't claim cross-source byte identity.

### Verified (no finding)

SDK:
- `node scripts/sync-outlit-skill.mjs --check` prints "verified at 4a3045c…".
- `docs/skill.md` differs from upstream `SKILL.md` only on lines 119 and 162 (the two pinned raw URLs).
- The manifest digests equal my independent sha256 of the three upstream files.
- I2 fixed: every non-`http(s)`/`mailto`/`#` inline and definition target is rejected, in `SKILL.md` and in the reference files, with tests.
- M3 fixed: `skill-source.json` is in `.mintignore`.
- M5 fixed: the name check is scoped to the frontmatter, with a test.
- I3 documented accurately: the `GITHUB_TOKEN` limitation, the label re-add to start CI, and the repo setting. Required checks `Changeset Check`, `Lint, Build & Test` and `Rust CI` all live in `ci.yml` with `labeled`/`unlabeled` triggers, so a human label toggle starts them.
- Workflow: `--sync` then `--check`, `add-paths` limited to the two generated files, a fixed branch, a concurrency group, job-level permissions, and schedule/dispatch only.
- M2: `--check` is in required CI (network-dependent, accepted); `--check-latest` is not in CI.
- M6: the freshness wording ("delay between an upstream skill merge and the docs site update") is accurate.

Marketing:
- The manifest is pinned to `4a3045c` with the full `outlit` bundle (3 files). The `outlit-sdk` digest `228d6858…` matches upstream at that SHA, and its only links are `#` anchors.
- The `[...path]` route serves only manifest-listed, path-regex-safe files from immutable `raw…/<rev>/…` URLs. It rejects a digest mismatch with 502 `no-store`, and returns 404 for unlisted files or an invalid manifest. The index is built from the committed manifest with no network (offline index preserved).
- The recursive link crawl rejects root-escaping and absolute-path references.
- The README notes the `GITHUB_TOKEN` CI limitation (close/reopen).
- The skills.sh URL `outlitai/skills/outlit` returns 200; the old path returns 307.

### Dispositions (root, 2026-09-27)

- **P2-I1:** accepted. Marketing will rewrite the root `outlit` SKILL.md reference links to absolute raw URLs pinned to the SHA, with separate source and served digests. No archives.
- **P2-I2, and the P2-M2 concurrency/permissions item:** reported as fixed before my report. I'll re-read the actual files in the targeted delta.
- **P2-M1:** the description will be derived from upstream.
- **P2-M3:** Mintlify preview is unavailable before the PR. The gate runs on the preview if one exists, otherwise after deploy, and is not claimed complete until then.
- **SDK and skills:** no further review.

Targeted delta checklist (marketing only):
- The route verifies the fetched upstream bytes against the **source** digest *before* transforming.
- The v2 index `digest` (and `/.well-known/skills` if it stays v2) is the sha256 of the exact **served** bytes. skills@1.5.13 checks the digest over the served bytes and silently yields no skill on a mismatch.
- The transform is deterministic and uses the pinned `sourceRevision`, not `main`.
- The relative-link rejection matches the SDK's rules, so no relative target survives.
- An isolated `skills add` run (or an equivalent unit test over the handler output) shows digest verification passing.
- The derived description equals the frontmatter at the pinned SHA.
- The P2-I2 cron and README agree.
- Concurrency and job-level permissions are present.

### Skills repo delta (`/home/leo/.herdr/worktrees/skills/docs-agent-discovery-consistency`, base `4a3045c`)

Pre-reviewed 2026-09-27; unchanged at final (HEAD `4a3045c`, 1 file, +1/−11). Accepted.

- Scope: the working tree changes only `skills/outlit/SKILL.md`, in the `## Docs` section. An 11-item list of bare URLs becomes one paragraph with two absolute links: `https://docs.outlit.ai/llms.txt` and `https://docs.outlit.ai/`. No behavior, auth, frontmatter or reference files changed.
- Coverage: the live `llms.txt` (200, `text/plain`, 47 lines) lists `.md` links for all 10 removed deep pages. All 10 also remain in the overhauled SDK `docs/docs.json`, so nothing is orphaned by either change.
- Downstream compatibility: both links are absolute. They pass the SDK sync's new relative-link rejection and need no rewrite by marketing.
- **Minor:** agents take one extra fetch (index, then page) and lose the curated shortlist. The index is Mintlify-generated and will grow with the overhaul (product and guides pages), so the pointer stays valid across IA moves. Acceptable.
- **Rollout (not a defect):** the SDK and marketing snapshots must keep serving the current `main` (`4a3045c`) until this change merges. After the merge, run the SDK `--sync` refresh PR and bump the marketing pin and hashes. A single refresh is enough: `--sync` refreshes because the SKILL.md digest changes.

---

## Targeted marketing delta (final)

This pass re-read the current marketing files:
- `src/lib/skill-markdown-transform.mjs` (new)
- `src/lib/first-party-skills.ts`
- the manifest
- `scripts/sync-first-party-skills.mjs`
- both test files
- `first-party-skill-refresh.yml`
- the README

For independent verification, I ran the committed transform in a scratch script against public raw bytes at `4a3045c`. No repo writes, and I did not run the tests or workflows.

### Important

**T-I1: the refresh workflow's test gate is pinned to today's content, so it blocks every real refresh.**
- Where: `first-party-skill-refresh.yml` runs `bun test … src/lib/first-party-skills.test.js` *after* `sync-first-party-skills.mjs` has rewritten the manifest.
- The failing assertions in that test file:
  - `:44` expects `index.sourceRevision` to be `"4a3045c9…"`.
  - `:52` fixes the exact file list.
  - `:57` expects the description to contain `"workspace users"`.
  - `:58` expects the SKILL.md `sourceDigest` to differ from `digest`, which fails if upstream drops its relative links.
- Why it matters: the sync only changes the manifest when skill content changes, and that always moves `sourceRevision`. So `:44` fails on every run that has something to publish, and create-pull-request never runs. The no-churn runs pass, which means the automation looks green and never delivers anything.
- Fix: either run only `scripts/sync-first-party-skills.test.js` (fixture-based) in the refresh job, or make the route test read the expected values from the manifest instead of hard-coding them. Keep the pinned assertions in normal CI only if someone agrees to update them in each refresh PR by hand.

### Minor

**T-M1: nothing in CI proves the committed served `digest` equals `transform(source@pin)`.**
- The route tests only cover rejections (502/404).
- If someone edits `skill-markdown-transform.mjs` without re-syncing, production `/.well-known/skills/outlit/SKILL.md` returns 502, and the index keeps advertising it.
- Mitigation that already exists: the scheduled job's `validServedDigests` notices the drift and opens a PR, but that only works once T-I1 is fixed.
- Fix: add one positive test with a small fixture, where the source digest is recomputed and the transform output is checked. Or add a pinned-revision verify mode, like the SDK's `--check`, to CI.

**T-M2: `skillDescription` reads only single-line scalars.**
- It rejects `>` and `|` block scalars, which is good.
- But a multi-line *plain* scalar (continuation lines indented under `description:`) is silently cut to its first line.
- It also strips surrounding quotes without unescaping YAML (`''` or `\"`).
- Impact is limited: the index description is advisory, and installers read the SKILL.md frontmatter.

**T-M3: the rewrite regexes also match inside fenced or inline code.**
- A future upstream sample shaped like `x[i](expr)` would throw.
- That fails closed (the refresh errors and nothing is published), so it only affects operability.

**P2-M2 still open.** `api.github.com/…/commits/main` is still called without authentication. Shared runner IPs can hit the 60 requests/hour limit and cause flaky failures. Passing `GITHUB_TOKEN` as a Bearer header, or using `git ls-remote` like the SDK, fixes this.

### Verified (no finding)

- **Source and served digests:**
  - The route fetches the immutable `/<sourceRevision>/` URL and checks `sourceDigest` *before* the transform.
  - It then runs the transform with the pinned `manifest.sourceRevision` and an allowlist of manifest paths, and checks `digest` on the exact bytes it returns.
  - It returns 502 `no-store` on any mismatch.
  - The index `digest` for the entry is the served digest, which is what skills@1.5.13 checks.
- **Independent recompute at `4a3045c`:** every `sourceDigest` and `digest` in the manifest matches. The transform gives the same output on repeated runs. SKILL.md changes only at L119 and L162, and no relative targets remain. References and `outlit-sdk` are unchanged, so for them `digest == sourceDigest`.
- **Cross-repo byte identity:** the marketing served SKILL.md (`ba434353…`) is byte-identical to the SDK `docs/skill.md`. That removes the difference in P2-M4 between these two hosts; last-install-wins still applies.
- **Transform safety:** it rejects `/`-absolute paths, backslashes, NUL, `?`, `..` escapes (after normalization) and paths not on the allowlist. Nested links resolve relative to the linking file.
  - The SDK instead rejects nested relative links in references.
  - This divergence is safe: if upstream adds one, the SDK sync fails while marketing proceeds. The rollout note should mention this.
- **Description:** comes from the frontmatter at the pinned SHA. It equals the canonical text for both skills. The name check is scoped to the frontmatter.
- **No churn:**
  - `sameSkillFiles` compares the description plus sorted `(path, sourceDigest)`.
  - `validServedDigests` recomputes served digests at the *current* pin, so a change that only moves the revision is a no-op (test `:96`).
  - Changes to reference bytes or to the transform both trigger a refresh.
- **Workflow:**
  - Cron `43 0,6,12,18 * * *` matches the README's "every six hours".
  - Top-level permissions are `contents: read`; the job has `contents`/`pull-requests: write`.
  - There is a concurrency group.
  - `add-paths` is limited to the manifest.
  - A fixed branch with `delete-branch`.
  - No `bun install` is needed because the tests import only builtins and local files.
  - Marketing `ci.yml` runs on bare `pull_request` (the default types include `reopened`), so the documented close-and-reopen step does start CI.
  - README and PR body describe the `GITHUB_TOKEN` limitation and don't overstate freshness.
- **Working tree:** a transient `.agents/skills/outlit-sdk` and a `skills-lock.json` change (from the installer smoke) appeared in one status snapshot. Both are gone now, leaving an empty `.agents/skills/` directory that git doesn't track. Recheck `git status` before committing.

### T-I1 fix verified (closing)

- `src/lib/first-party-skills.test.js` (mtime 20:11) now imports `./first-party-skills-manifest.json`. Every assertion that pinned today's content now takes its expected value from the manifest:
  - `sourceRevision` (`:45`)
  - the description, and each file's path, `sourceDigest` and `digest` (`:54-55`)
  - the root `SKILL.md` digests (`:60-61`)
  - the revision in each file's source URL (`:63`)
  - the supporting file that gets tampered with (`:72`)
  - the unlisted path (`:86-88`)
- The structural and integrity checks are unchanged:
  - The index builds offline.
  - Altered bytes return 502 "digest did not match" for both SKILL.md files and for a supporting file.
  - Upstream requests go only to the pinned revision.
  - Unlisted and traversal paths return 404 without fetching.
- Checked against the workflow: the refresh job writes the manifest, then runs `bun test`, which imports the freshly written JSON. The only fixed values left are the two skill names (`:25`, `:46`), and the sync script hard-codes the same two.
- Simulation, in a scratch copy with no repo writes: a manifest with a new revision, a new description, a removed reference, an added reference and new digests passed 5/5. The committed manifest also passed 5/5.
- **Result:** a real content refresh no longer fails before create-pull-request runs. T-I1 is closed.

**Recorded, not blocking:**
- T-M1: a continuous positive-path test is still a possible improvement.
- T-M2 and T-M3: the parser limitations.
- P2-M2: the metadata fetch is still unauthenticated.

This review makes no deployment claim.
