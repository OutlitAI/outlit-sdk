# Documentation Restructure Design

## Problem

The current Getting Started and Identity & Resolution docs have issues:

1. **Duplicated content** - Auto-identify explained in 3 places, identity flow in 2 places
2. **Pages mix concepts with implementation** - Hard for AI/users to extract clear answers
3. **Oversharing** - Cookie formats, session internals, extensive debugging sections
4. **Poor GEO optimization** - Headings don't match query patterns, no quick-answer summaries
5. **"Stages" misplaced** - Crucial concept buried in "Getting Started"

Total current length: ~1,700 lines across 6 pages (excessive for early-stage company).

## New Structure

### Tab 1: Getting Started (3 pages, ~350 lines)

| Page | File | Content |
|------|------|---------|
| Welcome | `index.mdx` | Value prop, choose integration path (keep as-is) |
| Quick Start | `tracking/quickstart.mdx` | Install → Init → Verify → Identify (stripped down) |
| How It Works | `tracking/how-it-works.mdx` | NEW: Single conceptual overview |

### Tab 2: Concepts (3 pages, ~500 lines)

| Page | File | Content |
|------|------|---------|
| Customer Journey | `concepts/customer-journey.mdx` | Stages + Billing (renamed from stages.mdx) |
| Identity Resolution | `concepts/identity-resolution.mdx` | Auto-identify, manual identify, merging |
| Anonymous Tracking | `concepts/anonymous-tracking.mdx` | Pre-ID tracking, fingerprints, company enrichment |

## Content Changes

### DELETE: `tracking/overview.mdx`

Duplicates content from quickstart and identity pages. Merge unique content into "How It Works".

### SLIM: `tracking/quickstart.mdx` (240 → 120 lines)

**Remove:**
- "What's Captured Automatically" table → move to "How It Works"
- Inline loader script → just show simple CDN tag

### SLIM: `tracking/stages.mdx` → `concepts/customer-journey.mdx` (348 → 200 lines)

**Remove:**
- Server-side usage section → move to `server/nodejs.mdx`
- Best practices code comparisons → simplify to prose

### SLIM: `identity/overview.mdx` → `concepts/identity-resolution.mdx` (410 → 250 lines)

**Remove:**
- Best practices 3 & 4 (multiple emails, update traits on changes)
- Debugging accordions → consolidate to single callout box

### SLIM: `anonymous-visitors.mdx` → `concepts/anonymous-tracking.mdx` (435 → 250 lines)

**Remove:**
- Visitor ID Storage section (cookie format, localStorage keys)
- Session Management section
- Edge Cases → condense to 1 paragraph callout
- "Accessing Anonymous Data" code examples

## Navigation Update

```json
{
  "groups": [
    {
      "group": "Getting Started",
      "pages": ["index", "tracking/quickstart", "tracking/how-it-works"]
    },
    {
      "group": "Concepts",
      "pages": [
        "concepts/customer-journey",
        "concepts/identity-resolution",
        "concepts/anonymous-tracking"
      ]
    },
    {
      "group": "Browser SDKs",
      "pages": ["tracking/browser/script", "...existing pages..."]
    },
    {
      "group": "Server SDKs",
      "pages": ["tracking/server/nodejs", "tracking/server/rust"]
    }
  ]
}
```

## GEO Enhancements

For each page:

1. **TL;DR opener** - First 2 sentences directly answer "What is this?"
2. **Question-based H2s** - "How does auto-identify work?" vs "Auto-Identify"
3. **Citable specifics** - "links anonymous history within 5 minutes"

## Implementation Tasks

1. Create `tracking/how-it-works.mdx` - merge unique content from overview.mdx
2. Create `concepts/` directory and move/rename files
3. Slim `quickstart.mdx` - remove table, simplify script
4. Slim `customer-journey.mdx` - remove server examples, simplify best practices
5. Slim `identity-resolution.mdx` - remove BP 3&4, consolidate debugging
6. Slim `anonymous-tracking.mdx` - remove storage details, session mgmt, edge cases
7. Update `docs.json` navigation
8. Delete `tracking/overview.mdx`
9. Move server-side stage examples to `server/nodejs.mdx`
10. Add GEO enhancements (TL;DR, question headings) to all pages

## Expected Outcome

- **Before:** ~1,700 lines, 6 pages, duplicated content
- **After:** ~850 lines, 6 pages, clear separation of concerns
- **50% reduction** in content while preserving all essential information
