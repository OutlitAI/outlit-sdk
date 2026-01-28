# Outlit Documentation

This repository contains the documentation for Outlit - the customer journey platform.

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
├── tracking/
│   ├── overview.mdx             # Tracking system overview
│   ├── quickstart.mdx           # Quick start guide
│   ├── browser/
│   │   ├── script.mdx           # Script tag integration
│   │   ├── npm.mdx              # NPM package
│   │   └── react.mdx            # React integration
│   ├── server/
│   │   └── nodejs.mdx           # Node.js SDK
│   └── identity/
│       ├── overview.mdx         # Identity resolution
│       └── anonymous-visitors.mdx
└── api-reference/
    ├── introduction.mdx         # API overview
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
