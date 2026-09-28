# Outlit Documentation

Documentation for Outlit, the product that continuously monitors long-tail customers, surfaces
retention and expansion opportunities with evidence, and completes approved customer work. The docs
are product-first for customer success teams, with dedicated developer/agent and API reference
paths.

## Local Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mintlify), then from this directory (where
`docs.json` is):

```bash
bunx --bun mint dev
```

Validate before publishing:

```bash
bunx --bun mint validate
bunx --bun mint broken-links
```

## Documentation Structure

`docs.json` navigation defines three tabs:

```
docs/
├── index.mdx                     # Product landing page (textured title hero)
├── getting-started/              # Product onboarding: overview, connect data, first attention item
├── product/                      # Attention items, customers, actions and approvals,
│                                 # responsibilities, workspace access
├── guides/                       # churn, expansion, renewals
├── integrations/                 # Connections overview + provider guides
├── concepts/                     # customer-context-graph, customer-journey,
│                                 # identity-resolution, website-visitors
├── ai-integrations/              # Agent entry points: overview, MCP, skills, Pi,
│                                 # platform actions, workflows, troubleshooting
├── cli/                          # Outlit CLI
├── tracking/                     # Outlit SDK quickstart, browser + server guides
├── use-cases/                    # Agent workflow examples (openclaw)
├── api-reference/                # API concepts; openapi.json is generated from Core's
│                                 # capability catalog — do not hand-edit
├── docs.json                     # Navigation, brand, SEO/AEO config
├── styles.css                    # Brand layer incl. textured title hero
├── .mintignore                   # Internal files excluded from publishing
└── superpowers/                  # Internal plans/specs — mintignored, never published
```

## Writing Conventions

- Canonical product language comes from the marketing repo's `CONTEXT.md`: long-tail customers,
  customer context, customer context interfaces. Do not call Outlit a developer platform or CDP.
- Product claims must match shipped behavior. Describe gated or in-progress features with customer
  availability language; never internal flag names.
- Screenshots: verified product UI on demo data, or clearly labeled illustrative UI. No real
  customer data.
- Prefer direct answers, concrete tasks, and short paragraphs. Avoid introducing internal agent,
  automation, or signal configuration as customer setup steps.
- Pages not in `docs.json` navigation are excluded from search, sitemaps, and `llms.txt`
  (`seo.indexing` is `navigable`); keep internal material out of the nav or in mintignored paths.

## Editorial and visual standard

- Use sentence case for page titles and headings; preserve product names and code identifiers.
- Start with the reader's task or answer. Put routine explanation in the body. Use `Info` for a
  useful aside and `Warning` for a concrete risk, such as lost events or an unwanted write.
  Do not use color to distinguish otherwise equivalent guidance.
- Keep availability guidance on the feature's own page and link to it elsewhere. Describe what
  the reader can use without exposing internal flags or release procedures.
- Use two-column tables where possible, group long references by task, and check them on mobile.
- Keep fictional-data captions visible. Screenshots complement complete written instructions.
  Use Mintlify's native click-to-enlarge behavior; do not add separate full-size image links.
- Palette: ivory (`#FCF7F1`), dark (`#16161A`), and slate; Google Sans matches the marketing site.
  The header uses marketing’s exact `public/images/logos/outlit-logo.png` (copied to
  `logo/wordmark.png`), at the same 96–112px responsive width. The source is a PNG,
  not an SVG; light mode inverts the white artwork and dark mode keeps it white.
  The home page styles Mintlify's native heading with the marketing resources-page texture, so
  it has one visible title. The `.docs-home` marker scopes that treatment in `styles.css`.
- Typography follows marketing's `src/lib/fonts.ts` and shared roles in `src/app/globals.css`:
  Google Sans variable for display, body, and controls; Google Sans Code variable for code.
  Page titles use the shared `t-h1` scale (30–40px), section headings use `t-h2` (24px) and
  `t-h3` (18px), and semantic headings stay regular (400). Lead copy is 17px/1.55, body copy
  16px/1.6, and top navigation 15px/1.5 at medium (500). Action buttons follow Core’s default
  Button: 32px height, 13px medium text, 10px horizontal padding, and 8px radius. Card and step titles remain
  compact 16px controls; card and callout supporting copy uses 14px/1.55. The licensed Latin WOFF2 assets and their OFL files live in `fonts/`;
  `docs.json` registers the sans family while `styles.css` sets the variable weight range and
  code family. Font sources: [Google Sans v70](https://fonts.google.com/specimen/Google+Sans)
  and [Google Sans Code v20](https://fonts.google.com/specimen/Google+Sans+Code), served by
  Google Fonts; the matching OFL text comes from the Google Fonts and Google Sans Code projects.
- Sidebar section labels use semibold slate text; page links use a quieter slate color in both
  desktop and mobile navigation. Preserve the selected-page fill and focus styles.
- Prefer short steps to diagrams that repeat prose. The customer-context graph and visitor
  sequence use light/dark and desktop/mobile SVGs generated without external dependencies:

```bash
bun scripts/docs-diagrams.ts  # from the repository root
```

The generator embeds the licensed Google Sans font from `scripts/assets/`; its source and OFL
license accompany the font and published SVGs. Edit the generator, then commit its output under
`docs/images/diagrams/`. Keep the full meaning
in adjacent Markdown for agents, search, and readers who cannot see the image. Check both
color themes at desktop, 390px, and 320px widths; labels must remain readable rather than
shrinking with a wide artboard. See the internal editorial review plan for evaluated renderers.

## Adding New Pages

1. Create a new `.mdx` file in the appropriate directory.
2. Add frontmatter with `title` and `description` (query-first, under ~170 characters).
3. Add the page path to `docs.json` navigation — pages absent from nav are not indexed.
4. Preview locally with `bunx --bun mint dev`, then run `mint validate` and `mint broken-links`.

## Publishing Changes

Push changes to the `main` branch to automatically publish to production. Mintlify generates
`llms.txt`/`llms-full.txt` and Markdown exports from navigation and page descriptions — prefer
those generated surfaces over hand-maintained copies.

After an authorized deployment, check the hosted search, `/llms.txt`, `/llms-full.txt`, and a
representative page's Markdown export. Confirm that new product and agent pages are discoverable
and that internal plans and release instructions are excluded. The local preview does not serve
all of these hosted features. Check the documentation search MCP separately from Outlit's
workspace-scoped product MCP; they serve different purposes.

The current product images render Core's actual Attention card components with fictional data.
Capture details and source revisions are recorded in
`superpowers/plans/2026-09-27-documentation-screenshots.md`. Refresh images when the underlying UI
changes, keeping demo-data captions and accessible descriptions.

## Outlit agent skill on this docs site

`skill.md` is generated from the maintained `skills/outlit/SKILL.md` in
[OutlitAI/skills](https://github.com/OutlitAI/skills). The source commit and SHA-256 digests for the
skill and its two reference files are recorded in `skill-source.json`. The only transformation
replaces relative reference targets with `raw.githubusercontent.com` URLs pinned to that same
commit. The manifest is excluded from the published site by `.mintignore`. Do not edit either
generated file by hand. The CLI's skill installer continues to use the GitHub skill repository
directly.

From the repository root, use:

```bash
node scripts/sync-outlit-skill.mjs --check         # verify committed files against the pinned source
node scripts/sync-outlit-skill.mjs --check-latest  # also detect changed content on upstream main
node scripts/sync-outlit-skill.mjs --sync          # refresh from upstream main
```

The scheduled or manually dispatched `Sync Outlit docs skill` workflow runs `--sync` and creates
or updates a review PR when the skill or reference bytes change. An unrelated upstream commit
does not change the pinned revision or open a PR. The workflow does not merge or push to `main`.
Because it uses `GITHUB_TOKEN`, its PR creation and updates do not trigger ordinary
`pull_request` CI. A maintainer must trigger CI by removing and re-adding the `skip-changelog`
label, review the PR, and merge it through the normal process. The repo setting that allows
GitHub Actions to create pull requests must be enabled.

Mintlify serves the custom root `skill.md` after the SDK PR merges and the docs site deploys.
On a hosted Mintlify PR preview, when available, check `/skill.md`, both well-known skill
indexes, and that each advertised digest matches its served body. Verify a docs-URL skill
install can read both pinned reference URLs. Repeat these checks on production after deployment. This is a static deployment:
there is a delay between an upstream skill merge and the docs site update. The GitHub installer
can use the upstream bundle immediately.

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [MDX Syntax Reference](https://mintlify.com/docs/text)
- [Component Reference](https://mintlify.com/docs/components)
