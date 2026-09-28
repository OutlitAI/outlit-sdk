# Editorial and visual refinement

User requested an independent Claude Opus 5.5 Herdr critique, all-page clarity and visual consistency, coherent callout semantics, and better Mermaid rendering. This extends the authorized docs overhaul; no publication requested.

## Baseline

55 navigable pages, 113 callouts, eight Mermaid diagrams. Local preview is also served at https://omarchy.tail0de74f.ts.net:8448. Existing source-verified technical contracts and product corrections must remain intact.

## Work sequence

1. Independent Opus 5.5 review of every page and representative rendered templates, with explicit coverage ledger.
2. Compare Mintlify-native Mermaid/ELK with an open-source static SVG renderer using actual visual prototypes. Prefer readable structure, mobile legibility, accessible text, and reproducible assets over cosmetic recoloring.
3. Establish a concise editorial/component standard; apply across product and technical docs with separate ownership.
4. Review the changed site again with Opus, correct concrete remaining issues, then verify navigation, MDX, examples, and representative light/dark/mobile pages. Stop when requested surfaces are covered and no material findings remain; do not churn already-correct pages.

## Research

- Mintlify supports ELK layout, zoom/pan controls, and per-diagram control options: https://www.mintlify.com/docs/components/mermaid-diagrams
- Mintlify custom React components cannot import third-party npm packages, so a renderer should run offline rather than inside MDX: https://www.mintlify.com/docs/customize/react-components
- Mintlify callouts have distinct preset styles; select one component per editorial purpose: https://www.mintlify.com/docs/components/callouts
- Beautiful Mermaid supplies an open-source SVG renderer with flowchart/sequence support and custom palettes: https://github.com/lukilabs/beautiful-mermaid

## Implemented visual decisions

- Neutral asides use Info with one quiet ivory/slate treatment; warnings retain their distinct
  risk meaning. Routine explanatory and availability text belongs in the page body.
- Home uses one native H1 on the marketing texture. Nine cards serve the two audiences;
  developer concepts live in the developer tab. Dark-mode primary CTA has a light surface.
- Eight Mermaid blocks became two deliberately laid out diagrams and six text explanations.
  `beautiful-mermaid@1.1.2` was prototyped but its generic layout and small labels did not meet
  the mobile readability requirement. Native Mintlify ELK and controls were also evaluated.
- `scripts/docs-diagrams.ts` generates eight static SVG assets (two diagrams, two themes, two
  layouts) without third-party packages. Native SVG text avoids Mintlify CDN `foreignObject`
  stripping. Container queries pick the layout; a 320px screen scrolls the 350px mobile image
  instead of reducing label size. Full relationships remain in Markdown for agents.
- Product screenshots remain actual Core components with fictional fixtures and visible
  captions. Direct full-size image links supplement Mintlify's enlargement control, which
  did not reliably open in the local mobile preview. A fresh narrow capture was inspected,
  but the actual component's compressed action row made it less useful; it was not published.

## Verification

- All 55 routes rendered at 1440px and 390px: 110 checks, one H1 per page, no page-level
  overflow, broken images, or rendering errors. This is structural evidence, not a substitute
  for the independent editorial review and visual inspection.
- Home and onboarding representative axe scans: no reported violations; contrast over
  textured backgrounds and other incomplete automated checks still require visual inspection.
- Diagram worker verified both themes, 390px and 320px rendering, native image dimensions,
  XML safety, and byte-identical generation on repeated runs.
- Final prose, navigation, contracts, and links are checked after the last editorial fixes.

## Second-review source checks

Verified against Core `8df25b21566943aa9eb1b53d2f165902fa3c8eee`:

- `settings-navigation.tsx`, `tracking-setup.tsx`, and `header-command.tsx` name the settings
  screen **Website Visitors**, at `/settings/workspace/website-visitors`. The old Website
  Tracking label is not the current UI label.
- Tracking `identify.ts` and `ingest.ts` use **Meeting requested** / **Meeting requested via
  provider** for `MEETING_REQUESTED`. An email-only server event cannot identify an unrelated
  anonymous browser visitor; linking requires a matching resolved identity.
- `renewal-cycle-controls.tsx` uses separate `resolve_attention` and `set_manual_outcome`
  commands. Closing an attention item must not be described as recording the renewal outcome.

Second diagram iteration embeds licensed Google Sans, with its exact OFL notice in each SVG
and a published license file. Desktop figures now fill the column up to 720px and switch
below a 600px container; mobile figures remain centered at 350px. Shared labels and measured
text bounds prevent content drift and clipping between variants. The generator remained
deterministic; all eight SVGs passed XML/resource checks and actual browser font-load checks.

## Final checks and limits

- Final documentation contract suite: 41 tests across six files passed. Existing tests changed
  only to follow sentence-case headings, the API reference label, and equivalent activation
  wording; generated-schema and code-example assertions were retained.
- A second complete 55-route desktop/mobile structural sweep passed (110 renders).
- The authored diagram regions pass focused axe checks at 320px and accept arrow-key scrolling.
  Home and onboarding scans reported no violations. These are scoped checks, not a claim of
  full-site accessibility conformance. The local Mintlify MCP page still exposes duplicate
  built-in table-region labels and non-focusable built-in code scrollers in axe; this pass does
  not patch Mintlify internals with custom DOM scripts.
- Hosted search, Markdown exports, llms.txt/llms-full.txt, and the documentation-search MCP need
  checking after deployment. The local preview does not provide all hosted services.
- Preview remains available through Tailscale Serve on HTTPS port 8448. No publication or
  stable SDK release was performed.

## Review outcome

Opus 5.5 independently reviewed all 55 routes, re-reviewed the diagrams and brand treatment,
and confirmed the fixes in focused follow-up passes. Its final clearance records no remaining
P1 or P2 findings from the review. See `2026-09-27-documentation-review.md` for the findings,
coverage, dispositions, and optional minor suggestions.

Final inventory: 55 routes, 26 callouts (from 113), zero Mermaid blocks. Two custom diagrams
replace the useful visual relationships; six simpler flows are written as steps or prose.
A direct rendered-anchor audit checked 42 local fragment links across 11 target pages and
found no missing targets after preserving renamed section anchors.

## Marketing typography follow-up

Compared marketing origin/main `3ef83162bd1e6aebcc98b477f7600e65940913f9`
(`src/lib/fonts.ts`, `src/app/globals.css`, `DESIGN.md`) and computed styles on
www.outlit.ai. Docs now use self-hosted variable Google Sans and Google Sans Code,
with both OFL licenses included. The shared marketing roles determine the docs scale:
30–40px regular page titles, 24px/18px regular section headings, 17px lead copy, 16px
body copy, 14px supporting copy, and 15px medium top navigation/CTAs. Cards and step
titles remain compact 16px medium labels. This uses shared typography roles; the
marketing homepage display scale and blog-specific prose overrides are not applied
to documentation.

Rendered checks confirmed loaded font faces and actual computed typography, including
nested CTA labels, steps, cards, callouts, and API endpoint headings. Root inspected
desktop and mobile screenshots through Tailscale and the API reference in dark mode.
Mintlify validation and whitespace checks passed after the final styling changes.

The typography sweep covered all 55 routes at 1440px and 390px (110 renders): no
page overflow, broken images, render errors, or unexpected heading weights above 500.

### Navigation font-flash investigation

The user reported a transient font change on Product navigation, then confirmed that
refreshing cleared it. Ordinary Tailscale sidebar navigation traces kept Google Sans
loaded and page-title typography stable. A MutationObserver confirmed that Mintlify
recreates the custom style/font-face nodes on route changes. Under a controlled
450ms network latency, the new Google Sans face spent approximately 425ms loading
on responsibilities → workspace-access. The local font endpoint serves
`Cache-Control: public, max-age=0`, so dev revalidation can expose fallback text despite
unchanged computed font-family. No additional source workaround was applied after the
user confirmed the issue cleared. Verify hosted navigation/cache behavior after
deployment; this investigation does not establish that production has the same delay.

## Navigation, controls, images, and wordmark follow-up

User screenshot review exposed duplicate generated API sidebar entries that the earlier
55-route inventory had missed. The canonical three endpoint pages now bind directly to
the generated OpenAPI file; tab-level auto-navigation is removed and the three old
auto-generated URLs redirect to the canonical routes. The spec remains unchanged. A
Mintlify presentation overlay supplies readable request/response/event choice titles
and consistent endpoint summaries. Opus 5.5 independently reviewed the actual sidebar,
playground, and responsive styles, then checked the resulting corrections.

Sidebar labels now use 600-weight slate headings with quieter links. Opus caught the
initial slate-500 link contrast being just under AA on ivory; light links now use
slate-600 (#475569). Focused axe checks of the sidebar in light and dark reported zero
violations. Main actions use the Core default Button dimensions from
`packages/ui/src/components/button.tsx`: 32px high, 13px medium text, 10px horizontal
padding, and 8px radius. This includes home CTAs, Open app, search, Copy page, Try it,
Send, and optional-field controls. Navigation rows retain their layout; smaller code
copy controls remain compact.

Removed both redundant “View the full-size example” links. The two product screenshots
retain their captions and native click-to-enlarge viewers; a search of all MDX found
no remaining separate full-size image links.

The header now uses the exact marketing wordmark asset, copied without pixel changes
from `marketing/public/images/logos/outlit-logo.png` to `docs/logo/wordmark.png`. The
marketing repo currently has no Outlit SVG wordmark, so this uses its 480×153 PNG,
with CSS inversion for light mode, just as the marketing header does. Its responsive
width matches `marketing/src/components/nav.tsx`: clamp(96px, 10vw, 112px). Rendered
checks confirmed 112×35.7px desktop and 96×30.6px mobile, with no overflow. Opus checked
both themes and sizes independently.

Final API follow-up: all 42 docs tests passed, and Mintlify validation and broken-link
checks passed. After reloading the preview's transformed OpenAPI spec, Opus verified
zero “Option N” labels on the tool response and ingest event schemas, including the
playgrounds. The 101-action overlay changes presentation metadata only. The local
Mintlify preview returns 404 for the raw `/openapi.json`; the current hosted docs
serve it successfully. Hosted behavior for this uncommitted overhaul remains to be
checked after deployment.

## Outlit SDK naming and acquisition follow-up

Qualified published browser/server SDK references with Outlit, including titles,
links, tables, diagram labels, and image descriptions. SDK guidance now explains
landing pages, referrers and available UTM parameters, anonymous website activity,
browser identification linking earlier history, and subsequent conversion and use.
Server SDKs contribute backend/native events; server email alone does not link an
anonymous browser visitor. The customer-success homepage positioning is preserved.

Opus 5.5 reviewed the final copy and rendered the tracking overview and PostHog
guide at 1440px and 390px: no horizontal overflow or MDX errors. Both important
review findings were resolved: unqualified SDK names, and an overly broad claim
about PostHog import coverage. Core's PostHog mapper retains URL/referrer properties;
the final comparison describes Outlit's direct visitor-history and identification
benefit without claiming PostHog lacks attribution. Diagram labels were regenerated
and checked for fit (141px SDK label within the 156px browser actor card).

Final SDK-copy validation: `bunx --bun mint validate` passed; `bunx --bun mint
broken-links` found no broken links. Root's `git diff --check` passed. These checks
apply to the uncommitted docs overhaul on SDK base `fe951fa`, served through the
existing Tailscale port 8448.
