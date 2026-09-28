# Product-first documentation overhaul

**Goal:** Help customer-success and go-to-market teams connect customer data, understand renewal risk and expansion opportunities, and act on evidence, while providing accurate technical instructions for developers and agents.
**Source:** User request on 2026-09-27 and subsequent clarification: app-first onboarding; connect data, then understand automatic churn/expansion alerts around renewal. Marketing examples inform the use cases.
**Approach:** Audit current marketing, Core, and SDK; organize documentation around the product journey; retain deep technical references; validate source claims, navigation, rendering, and machine-readable discovery.
**Scope:** SDK repository documentation, navigation, visual branding, technical examples, and contributor guidance. Core and marketing are reference sources. No production mutations, publication, SDK release, or PR push is implied.
**Key risks:** Marketing illustrations can exceed shipped behavior; main may exceed production or stable SDK versions; permissions affect visible evidence; route changes can break external links; custom agent indexes can drift. Ground procedural claims in implemented interfaces, record availability limits, preserve URLs, and prefer Mintlify-generated discovery.
**Completion:** Coherent product and technical journeys, reviewed against source, with passing docs validation and contract checks, checked desktop/mobile rendering, and a clear report of any deployment-only verification limits.

## Confirmed user decisions

- Primary audience: customer-success teams managing long-tail retention, renewals, and expansion, with developers and external agents still fully supported.
- Entry journey: connect tools and reach a useful result in the app. The first useful result is **attention items**.
- Onboarding is currently guided, not self-serve. Public getting-started documentation must reflect provisioned access and working with the Outlit team. Future self-serve signup is not an existing workflow.
- All product areas are in scope, including implemented features behind feature flags. Document customer-facing availability without claiming universal access.
- Research other strong GTM documentation and propose applicable patterns; see the adjacent documentation-references artifact.
- **User direction overrides legacy Core models:** Outlit builds opinionated agents for customers. Customers connect data and receive attention items; they do not configure agents, automations, or signal rules. Do not document legacy builders as the intended product workflow.
- Visual branding and screenshots are required, including the textured resource-page title treatment from marketing. Use authentic demo product screenshots; record screenshot provenance and availability rather than presenting a mockup as a live screen.
- User prefers **Attio** as the primary documentation reference, scaled to Outlit's smaller content surface. Favor compact navigation and substantive pages; consolidate redundant routes instead of creating thin pages to fill an outline.
- Refinement: do **not** closely imitate Attio. The desired quality is a GTM product that communicates technical excellence, expressed through Outlit's own branding, texture, typography, and voice.

## Source baseline

- SDK: `fe951fa` (latest fetched main; clean task branch fast-forwarded from `101d83c`).
- Core: `8df25b21566943aa9eb1b53d2f165902fa3c8eee`, isolated `du-core-source` worktree.
- Marketing: `3ef83162bd1e6aebcc98b477f7600e65940913f9`, isolated `du-marketing-source` worktree.
- Canonical product language: marketing `CONTEXT.md`. Outlit is the product; customer context infrastructure describes its underlying layer, and customer context interfaces describe API/CLI/MCP/skills.
- Existing docs: `bunx --bun mint validate` passed before edits. Dependencies installed with `bun install --frozen-lockfile`.

## 1. Resolve product structure and source claims

Audit source-backed user journeys, integration availability, identity, permission boundaries, and public tool contracts. Keep a source map and record uncertain or gated functionality. User questions cover audience, onboarding, public feature scope, style, and visual changes; incorporate answers as they arrive.

**Ownership:** Lead owns audience decisions, integration, and final review. Herdr workers audit Core product behavior, marketing/brand, and technical documentation independently.

**Complete when:** Each proposed guide has a user purpose and evidence, and marketing illustrations are not mistaken for implemented controls or numerical guarantees.

## 2. Build the product journey

**Files:** `docs/index.mdx`, new product/getting-started/workflow/integration guides, existing `docs/concepts/`, `docs/tracking/quickstart.mdx` and `docs/tracking/how-it-works.mdx`.

- Lead with connecting tools in the app and reviewing a useful customer result.
- Explain customer profiles, source evidence, monitoring, renewal risk, expansion, and next actions in plain language.
- Provide setup prerequisites, expected results, empty/partial-state guidance, and troubleshooting.
- Keep identity resolution and tracking accessible without making SDK installation a prerequisite for ordinary product adoption.
- Preserve old URLs or supply redirects where needed.

**Verification:** Review procedural claims against Core; render representative guides; check navigation and local links.

## 3. Make technical documentation reliable for people and agents

**Files:** `docs/cli/`, `docs/ai-integrations/`, `docs/api-reference/`, `docs/tracking/browser/`, `docs/tracking/server/`, `docs/use-cases/openclaw.mdx`.

- Audit commands, auth, capabilities, SDK examples, identity behavior, and stable/main distinctions.
- Provide a clear agent starting point and task recipes for evidence-based customer queries.
- Distinguish reading, configuration changes, permission changes, and other writes.
- Keep generated OpenAPI and tool contracts authoritative and unchanged unless a verified documentation defect requires a separately reviewed correction.
- Link mutable reference catalogs rather than introducing redundant snapshots of versions or capabilities.

**Verification:** Source/contract review, existing `bunx vitest run tests/docs`, Mintlify validation and link checks. Add no tests that only restate copy edits.

## 4. Integrate navigation, brand, and discovery

**Files:** `docs/docs.json`, `docs/logo/`, `docs/favicon.svg`, documentation assets as needed, `docs/README.md`.

- Give product users the primary route, with dedicated agent/developer and API paths.
- Align visual treatment with current marketing while keeping docs readable on desktop/mobile and in light/dark appearance.
- Use accurate titles, descriptions, direct answers, and contextual links for human search and agent retrieval.
- Use Mintlify's generated `llms.txt`, `llms-full.txt`, and Markdown exports; document deployment checks without claiming a local build proves hosted outputs.
- Keep internal planning and release material out of public discovery.

**Verification:** `bunx --bun mint validate`, `bunx --bun mint broken-links`, docs contract tests, relevant JSON formatting, browser checks of entry paths and representative technical/product pages.

## Review and handoff

Review the combined diff for unsupported product claims, broken workflows, confusing terminology, auth mistakes, and missing routes. Reuse passing evidence for unchanged inputs; rerun affected checks after corrections. Summarize changed scope and remaining deployment-only checks. Do not push or publish without a user instruction.

## Validation evidence

- Runtime build: `bun run build` passed all six tasks on unchanged package sources.
- Browser preview: local Mintlify at `http://localhost:3000`, Chromium via agent-browser. Homepage checked at 1440×1000 and 390×844; light/dark logo visibility, Google Sans, title texture, one H1, and no horizontal page overflow verified. Mobile Get started link reached the provisioned-customer guide.
- First attention-item guide: actual component screenshot loaded; fictional-data caption visible; desktop dark rendering checked.
- Agent overview: mobile dark rendering and scrollable tables checked; mobile navigation opens, switches appearance, and reaches MCP Integration.
- Internal publication exclusions: local requests for `/superpowers/plans/2026-09-27-documentation-overhaul` and `/release-coordination` returned 404.
- Deployment-only limits: local Mintlify does not expose `/llms.txt`, `/llms-full.txt`, or page Markdown exports (404), and hosted search requires Mintlify authentication. Verify those generated surfaces and search after a separately authorized deployment; local checks cannot establish hosted discovery.
- Fresh source review identified unsupported approach/source-link guarantees, member-sharing omissions, readiness/empty-state caveats, and two unsafe technical examples. Corrections were incorporated and checked against the review findings before final validation.

- Technical verification: `bunx vitest run tests/docs` passed 41/41 tests across six files after the final technical edits. `bunx biome check docs/docs.json` passed.
- Fresh reviewer verified all seven technical findings resolved: consent-safe Next.js guidance, status-specific API retry behavior, merge request IDs, credential precedence, configuration-vs-freshness distinction, CLI/MCP name/schema mappings, and actual attention kinds.

## Completed implementation and final checks

- Added 21 product, integration, and agent guides. All 55 navigation entries exist, with no duplicate routes. Retained existing public technical URLs and generated contracts.
- Product entry path is guided access → connect sources → review an attention item. Outlit-managed monitoring replaces the legacy customer-configured agent/signal model in public guidance.
- Current marketing texture, Google Sans, ivory/slate palette, theme-aware logos, and matching light/dark flowchart colors are integrated. Authentic Core card screenshots use explicitly fictional data.
- Preserved SDK, CLI, MCP, API, and identity depth; repaired source-verified technical examples and added practical agent recipes and troubleshooting.
- Final combined checks: `bunx --bun mint validate` passed; `bunx --bun mint broken-links` found no broken links; `bunx vitest run tests/docs` passed 41/41 tests in six files; `git diff --check` passed. JSON formatting passed Biome. The unchanged package build passed six tasks earlier in this task.
- Browser checks additionally covered API Overview, CLI Command Reference (61 code blocks), renewal guide images, and customer-context diagrams in both appearances. Final attention-item page rendered with its corrected optional-approach language and loaded image.
- Source baselines are pinned above; this is verification against source and a local preview, not production or published stable-release verification.
- No runtime packages, generated tool contracts, OpenAPI, release versions, or tests were changed. No commit, push, or publication was performed.
- Hosted search, Markdown exports, generated `llms.txt`/`llms-full.txt`, and documentation-search MCP still require a post-deployment check. Instructions are in `docs/README.md`.

- Final independent review confirmed all reported product/integration findings and requested concept corrections resolved. Temporary Herdr worker tabs and read-only source worktrees were removed after review; the local Mintlify preview remains available for inspection.
