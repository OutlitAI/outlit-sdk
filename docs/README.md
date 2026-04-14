# Outlit Documentation

This repository contains the documentation for Outlit, customer context infrastructure that turns product, website, billing, support, and conversation data into complete customer profiles your team and agents can query.

## Local Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mintlify) to preview the documentation changes locally.

```bash
npm i -g mintlify
```

Run the following command at the root of your documentation (where `docs.json` is):

```bash
mintlify dev
```

## Documentation Structure

```
docs/
├── index.mdx                    # Homepage
├── concepts/
│   ├── customer-context-graph.mdx
│   ├── customer-journey.mdx
│   ├── identity-resolution.mdx
│   └── website-visitors.mdx
├── tracking/
│   ├── how-it-works.mdx         # Tracking and context graph overview
│   ├── quickstart.mdx           # Quick start guide
│   ├── browser/
│   │   ├── script.mdx           # Script tag integration
│   │   ├── npm.mdx              # npm package
│   │   ├── react.mdx            # React integration
│   │   └── ...                  # Framework guides
│   ├── server/
│   │   ├── nodejs.mdx           # Node.js SDK
│   │   └── rust.mdx             # Rust SDK
├── cli/
│   ├── overview.mdx
│   ├── commands.mdx
│   ├── integrations.mdx
│   ├── ai-agents.mdx
│   └── configuration.mdx
├── ai-integrations/
│   ├── mcp.mdx
│   ├── pi.mdx
│   └── skills.mdx
└── api-reference/
    ├── introduction.mdx         # API overview
    ├── validation.mdx           # API key validation docs
    ├── tools.mdx                # Customer intelligence tool call docs
    ├── integrations.mdx         # Integration management route docs
    └── ingest.mdx               # Ingest API docs
```

## Publishing Changes

Push changes to the `main` branch to automatically publish to production.

## Adding New Pages

1. Create a new `.mdx` file in the appropriate directory
2. Add frontmatter with `title` and `description`
3. Add the page path to `docs.json` navigation
4. Preview locally with `mintlify dev`

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [MDX Syntax Reference](https://mintlify.com/docs/text)
- [Component Reference](https://mintlify.com/docs/components)
