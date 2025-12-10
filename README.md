# Outlit SDK

TypeScript SDK for the Outlit events ingestion API. Track user interactions, page views, and custom events across web and server applications.

## Packages

This monorepo contains three packages under the `@outlit` scope:

- **[@outlit/core](./packages/core)** - Core SDK functionality and base client
- **[@outlit/browser](./packages/browser)** - Browser-specific SDK with automatic page view tracking
- **[@outlit/node](./packages/node)** - Node.js SDK for server-side event tracking

## Installation

Choose the package that matches your environment:

```bash
# For browser applications
npm install @outlit/browser

# For Node.js applications
npm install @outlit/node

# For custom implementations
npm install @outlit/core
```

## Quick Start

### Browser

```typescript
import { OutlitBrowser } from '@outlit/browser';

const outlit = new OutlitBrowser({
  apiKey: 'your-api-key',
  autoPageViews: true,
});

// Identify a user
outlit.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
});

// Track events
outlit.track('button_clicked', {
  button_id: 'signup',
  page: '/homepage',
});
```

### Node.js

```typescript
import { OutlitNode } from '@outlit/node';

const outlit = new OutlitNode({
  apiKey: 'your-api-key',
});

// Identify a user
outlit.identify('user-123', {
  email: 'user@example.com',
});

// Track server-side events
outlit.track('api_request', {
  endpoint: '/api/users',
  method: 'GET',
  status: 200,
});

// Use with Express
app.use(outlit.createMiddleware());
```

## Features

- **Modern TypeScript** - Full TypeScript support with type definitions
- **Tree-shakeable** - Optimized bundle size with dual ESM/CJS exports
- **Event Queueing** - Automatic batching and flushing of events
- **Multi-platform** - Separate packages for browser and Node.js
- **Auto-tracking** - Automatic page view tracking in browser
- **Middleware Support** - Easy integration with Express and similar frameworks
- **Persistent Identity** - User and anonymous ID persistence
- **High Performance** - Minimal overhead and efficient batching
- **Type Safe** - Full TypeScript support with strict types

## Development

This project uses a modern monorepo setup with the following tools:

- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager
- **[Turbo](https://turbo.build/)** - Build system for monorepo orchestration
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[tsup](https://tsup.egoist.dev/)** - Fast TypeScript bundler
- **[Biome](https://biomejs.dev/)** - Fast linter and formatter
- **[Playwright](https://playwright.dev/)** - End-to-end testing
- **[Changesets](https://github.com/changesets/changesets)** - Version management and changelogs

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Format code
pnpm format
```

### Project Structure

```
outlit-sdk/
├── .github/workflows/   # CI/CD workflows
├── packages/
│   ├── browser/         # Browser SDK with React bindings
│   ├── core/            # Shared types and utilities
│   ├── node/            # Node.js SDK
│   └── typescript-config/  # Shared TypeScript configs
├── package.json         # Root package with workspace config
├── pnpm-workspace.yaml  # pnpm workspace configuration
├── turbo.json           # Turbo build configuration
└── biome.json           # Biome linter/formatter config
```

### Creating a Changeset

When making changes that should be released, create a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the version bump type (patch, minor, major)
3. Write a description of the change

The changeset file will be committed with your PR and used to generate changelogs on release.

## CI/CD

### Workflows

- **CI** (`ci.yml`) - Runs on PRs: lint, typecheck, build, test, deploy canary IIFE
- **Release** (`release.yml`) - Runs on main: creates version PR or publishes to npm + CDN

### Required Secrets

For maintainers setting up the repository:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm access token with publish permission for `@outlit` scope |
| `GCP_CREDENTIALS` | Service account JSON key with Storage Object Admin on `cdn.outlit.ai` bucket |

#### Creating NPM_TOKEN

1. Go to [npmjs.com](https://www.npmjs.com/) and sign in
2. Navigate to Access Tokens → Generate New Token → Granular Access Token
3. Set permissions: Read and write for `@outlit` packages
4. Copy the token and add as `NPM_TOKEN` secret in GitHub

#### Creating GCP_CREDENTIALS

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin → Service Accounts
3. Create a new service account (e.g., `github-actions-deployer`)
4. Grant "Storage Object Admin" role on the `cdn.outlit.ai` bucket
5. Create a JSON key for the service account
6. Copy the entire JSON content and add as `GCP_CREDENTIALS` secret in GitHub

### CDN Deployment

The browser SDK IIFE bundle is deployed to Google Cloud Storage:

| Path | Description |
|------|-------------|
| `/canary/outlit.js` | Deployed on every PR for testing (5 min cache) |
| `/stable/outlit.js` | Latest stable release (1 year cache) |
| `/v{version}/outlit.js` | Immutable versioned release (1 year cache) |

Manual deployment (requires gcloud CLI):
```bash
pnpm --filter @outlit/browser deploy:canary   # Deploy to canary
pnpm --filter @outlit/browser deploy:stable   # Deploy to stable (requires confirmation)
pnpm --filter @outlit/browser deploy:version  # Deploy versioned release
```

## Documentation

- [Core SDK Documentation](./packages/core/README.md)
- [Browser SDK Documentation](./packages/browser/README.md)
- [Node.js SDK Documentation](./packages/node/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 - see [LICENSE](./LICENSE) for details.

## Support

- Issues: [GitHub Issues](https://github.com/OutlitAI/outlit-sdk/issues)
- Docs: [Documentation](https://docs.outlit.ai)
