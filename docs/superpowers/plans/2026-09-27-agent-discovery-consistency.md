# Agent discovery consistency implementation plan

**Goal:** Marketing and documentation direct agents to current maintained Outlit skills and canonical documentation, with no competing Mintlify-generated product skill.
**Source:** User-approved marketing corrections and explicit request to replace the Mintlify skill with the maintained skill while preserving the existing CLI install flow.
**Scope:** Marketing discovery copy, Mintlify custom skill distribution and freshness checks. No product MCP changes, customer setup redesign, or production publication.
**Key risks:** Static copies drift; relative skill references break on web hosting; generated skill discovery differs from a human page; product docs links precede deployment.
**Completion:** Own skill content replaces the generated source locally, references and refresh behavior are verified, existing CLI setup remains unchanged, marketing projections agree, and hosted checks/deployment limits are recorded.

## Marketing projections

Worktree: `/home/leo/.herdr/worktrees/marketing/docs-agent-discovery-consistency`, branch `docs/agent-discovery-consistency`, base `3ef8316`.

Update `public/index.md`, `public/llms.txt`, `public/llms-full.txt`, and description fields in public agent metadata. Separate guided product onboarding from SDK setup, link `https://docs.outlit.ai/llms.txt`, retain canonical technical references, and explain Outlit SDK discovery-to-conversion coverage. Existing focused tests cover indexing and discovery invariants.

## Maintained skill distribution

The canonical skill repository is `OutlitAI/skills` (the old `outlit-agent-skills` name redirects). The CLI source uses the unpinned repository; Core's CLI-auth onboarding instruction already uses `npx -y skills add outlitai/skills --skill outlit -g`. Preserve those flows.

Use Mintlify's documented custom skill override. Resolve and record the canonical source revision, preserve skill frontmatter and authorization boundaries, and ensure relative reference files remain retrievable. Determine a documented refresh mechanism before implementation; do not assume unsupported remote includes or reserved-route redirects work in production.

## Verification and rollout

- Review canonical skill content and required reference paths against current source.
- Test generation, reference handling, and freshness detection as applicable.
- Run Mintlify validation and broken-link checks after generated changes.
- Independently review the skill publishing and freshness path.
- Publish the docs overhaul before marketing links to new product routes.
- After authorized deployment, verify `/skill.md`, both skills discovery indexes, installer discovery, and documentation MCP resources. A local Mintlify render does not prove those hosted endpoints changed.

## Selected freshness and reference contract

Mintlify has no documented remote skill URL source. Generate the root `docs/skill.md`
from the maintained skill at a resolved upstream commit. Preserve its frontmatter
and prose; adapt relative reference URLs deterministically to absolute same-commit
raw GitHub URLs. This avoids assuming Mintlify installs supporting reference files.
Record the complete referenced-content digest set, check it reproducibly, and
propose refresh PRs on scheduled/manual checks. Ignore upstream commits whose
skill content is unchanged. Normal review, merge, and deployment still apply.

Marketing's maintained-skill mirror must preserve reviewed immutable content and
digest verification, update its stale source revision, and serve referenced files
through explicit discovery entries. Its freshness mechanism follows the same
refresh-PR model. The customer CLI continues using the canonical repository directly.

Passing local tests do not activate GitHub schedules, merge refresh PRs, or prove
Mintlify's hosted skill/index changed. Those require deployment.

## Canonical skill discovery edit

Skills worktree: `/home/leo/.herdr/worktrees/skills/docs-agent-discovery-consistency`,
branch `docs/agent-discovery-consistency`, base `4a3045c`.
The `outlit` skill's Docs section now uses the documentation index at
`https://docs.outlit.ai/llms.txt` and docs home instead of maintaining eleven deep links.
Authorization, commands, and reference files are unchanged. `bun run test` passed
17 tests and validation of both public skills; `git diff --check` passed.

Downstream snapshots remain pinned to the currently published canonical main,
`4a3045c9a1eefff79fb1d83bb7c9673467358dce`. Merge the canonical skill edit first,
then run both refresh scripts and include their updated manifests/artifacts in the
downstream changes before publishing. Do not fabricate an upstream revision for
unpublished local content.

## Installer evidence

A fresh project-local install in `/tmp/outlit-skill-install-audit.Laorrk` using
`bunx --bun skills@1.5.13 add https://github.com/OutlitAI/skills --skill outlit --agent codex --yes`
completed successfully. The installed SKILL.md and both references match the
canonical revision's SHA-256 digests in `docs/skill-source.json`. No user-global
skill installation was changed. This verifies the repository install path, not
Mintlify's still-unpublished hosted custom skill endpoint.

## Integration tools method badge (additional user request)

`api-reference/integrations.mdx` now declares the actual `POST https://app.outlit.ai/api/tools/call`
method using Mintlify's native manual API metadata, with the playground disabled. Its existing
complete authenticated request example uses `RequestExample`, avoiding an incomplete autogenerated
curl. Browser verification confirmed `POST Integration tools` in the sidebar and the correct request
panel; screenshot `/tmp/du-api-integration-badge.png`. Final docs tests: 52 passed; Mintlify validation
passed after this edit. No duplicate navigation entry or OpenAPI operation was introduced.


## Final verification and review

- SDK: 52 docs tests passed, Mintlify validation and broken-link checks passed.
- Canonical skills: 17 tests and both skill structure validations passed.
- Marketing: production build, TypeScript check, targeted formatting and 28 affected
  tests passed after the served-link correction. Final test-only refresh-gate correction
  passed the exact workflow test command (11 tests) and discovery tests (12 tests).
  Earlier full-suite evidence (425 tests) predates the served-link correction.
- Marketing HTTP smoke: both indexes and four skill files returned 200 with verified
  digests. An isolated skills@1.5.13 domain install via a local test-only origin proxy
  produced the correct transformed root skill; both absolute references resolved.
  Root independently confirmed the installed hash equals docs/skill.md:
  ba434353e753e91108da9bae6c39aa4a62447bb8fdef8eddd48ac32b2540b72d.
- Opus 5.5 independently reviewed the design and implementation. Fixed the missing
  installed-reference issue and a hard-coded test that blocked all real refreshes;
  final simulation of changed revision/description/reference list passed.
- Marketing now transforms relative Markdown references to immutable absolute URLs,
  validating upstream source digests before transformation and served digests afterward.
  This supersedes the earlier full-bundle installer assumption: v2 skill-md installers
  install only SKILL.md; the GitHub CLI path still installs local references.
- Recorded limits: the Markdown parsers are conservative; SDK rejects nested relative
  reference links while marketing resolves them. Unsupported upstream formatting can
  require a reviewed script update. Marketing metadata fetch can hit unauthenticated
  GitHub rate limits and fails visibly. Runtime/install checks cover the current exact
  transform; continuous positive-route coverage could be broadened separately.
- Broad SDK lint emitted Biome internal panics on generated dist files despite exit 0;
  it is not recorded as a clean lint result. No tracked package files changed.
- No commits, pushes, PR creation, merges, workflow dispatches, or deployments occurred.
  Refresh workflows become active after merge. Hosted Mintlify skill/index/installer
  checks remain pending a hosted preview or deployment. Existing Tailscale docs preview
  remains at https://omarchy.tail0de74f.ts.net:8448/ (HTTP 200 verified).

Detailed evidence: `2026-09-27-agent-skill-opus-review.md`,
`2026-09-27-marketing-skill-verification.md`, and
`2026-09-27-docs-skill-verification.md`. All are mintignored maintainer material.
