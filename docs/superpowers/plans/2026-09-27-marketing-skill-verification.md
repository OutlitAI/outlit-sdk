# Marketing maintained-skill freshness and reference correction

Worktree: `/home/leo/.herdr/worktrees/marketing/docs-agent-discovery-consistency`
Base HEAD checked: `3ef83162bd1e6aebcc98b477f7600e65940913f9`
Canonical `OutlitAI/skills` main checked: `4a3045c9a1eefff79fb1d83bb7c9673467358dce`

## Changes

- The generated manifest pins the canonical repo/revision, frontmatter descriptions, and separate source and served SHA-256 digests for `outlit/SKILL.md`, `outlit/references/identity.md`, `outlit/references/sql-reference.md`, and `outlit-sdk/SKILL.md`.
- The offline index lists every file. The runtime route fetches only manifest-listed files at the immutable revision, checks the source digest before transforming Markdown, and checks the served digest afterward. The `outlit` skill's relative links become absolute raw URLs at the same pinned SHA, so single-file domain installers can read both references. The domain reference routes remain available.
- The sync script follows inline and reference-style Markdown links recursively, rejects missing or unsafe references, and checks source hashes and description for no-churn. Unrelated upstream commits retain the old revision and verified served digests; reference-only changes update the manifest.
- A six-hour scheduled/manual workflow proposes manifest-only PRs with a fixed branch, concurrency group, and job-scoped write permissions. README and PR body document the `GITHUB_TOKEN` CI caveat and maintainer-triggered reopen step.
- Marketing skill source/registry links point to `OutlitAI/skills`. The seven accepted prior copy edits remain; customer CLI/Core installation commands and product MCP URLs remain as they were.

## Verification

- `node scripts/sync-first-party-skills.mjs --check`: current at the canonical revision above.
- Full suite before the installer correction: `bun test`: 425 pass, 0 fail, 79 files. After the correction, scoped sync/skill/discovery/governance tests: 28 pass, 0 fail.
- After the correction: `bun x tsc --noEmit`, scoped `bun x biome check`, `git diff --check`, and `bun run build` with CI placeholder env vars all passed. Next 16.3.0 compiled and generated all 70 static pages. Existing font override and Node deprecation warnings appeared.
- Local runtime at `http://localhost:3197`: both indexes and four files returned 200. The served root matched `sha256:ba434353e753e91108da9bae6c39aa4a62447bb8fdef8eddd48ac32b2540b72d`; source root matched `sha256:11a92cda5c338f5552edaaf7a9ff55c716b455a3433e02ea22979c17f6284e22`. Both references matched their source/served digests and the installed root contained absolute pinned links to them.
- Isolated `skills@1.5.13` install: a test-only proxy on `http://localhost:3198` mapped index `https://www.outlit.ai` URLs to local routes, leaving production response logic unchanged. `npx -y skills@1.5.13 add http://localhost:3198 --skill outlit --agent codex --yes` ran in `/tmp/du-skill-domain-install.KYysSP`, installed one root skill, and its bytes matched the index's served digest above. Both pinned reference URLs were fetched and their bytes matched source digests. The installer did not copy `references/` into the temp skill directory, as expected for v2 `skill-md`; installed links remain usable with network access.
- An accidental preliminary `skills add ... --help` invocation installed `outlit-sdk` in the worktree. Its untracked directory was removed and the sole `skills-lock.json` change was restored; final `git status` shows neither change. Both local servers were stopped and ports 3197/3198 are free.

## Remaining limits

- No commit, push, PR, GitHub workflow run, or deployment was performed. The scheduled PR and required CI trigger must be confirmed in GitHub after merge.
- The installer smoke used a test-only local proxy because the production index advertises absolute `www.outlit.ai` URLs; it did not test a deployed domain. It proved installer behavior against the local route bodies and digests.
- Installed domain copies need network access for pinned references. The GitHub/CLI install retains local reference files.
- A separate pending canonical docs-index edit is not in upstream main. Refresh the marketing manifest after that upstream change merges if it changes the served skill bundle.

## Final refresh-gate correction (T-I1)

The route and discovery tests no longer hardcode the current upstream revision, reference list, frontmatter wording, or an assumption that source and served digests differ. They derive expected values from the generated manifest and retain structural, URL pinning, digest, altered-source, and path rejection checks. This allows a valid canonical refresh, including one that changes or removes references, to pass the workflow test gate.

After this test-only edit, the exact workflow test command `bun test scripts/sync-first-party-skills.test.js src/lib/first-party-skills.test.js` passed (11/11). The affected discovery test `bun test src/lib/agent-readiness-discovery.test.js` passed (12/12), and `git diff --check` passed. No build or full-suite rerun was performed for the test-only edit; the earlier successful build remains the build evidence for unchanged production code.
