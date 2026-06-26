# Outlit SDK

Outlit is the real-time understanding of every customer, the infrastructure agents use to automate customer operations.

This repository contains the public SDK and developer integration packages for Outlit: browser, server, CLI, tool contract, and Pi packages for sending customer signals to Outlit and querying customer context from agent workflows. It is not the hosted remote MCP server implementation; use the canonical Outlit-owned discovery endpoints below for MCP, API, and agent metadata.

## Packages

This monorepo contains these packages under the `@outlit` scope:

- **[@outlit/core](./packages/core)** - Core SDK functionality and base client
- **[@outlit/browser](./packages/browser)** - Browser-specific SDK with automatic page view tracking
- **[@outlit/node](./packages/node)** - Node.js SDK for server-side event tracking
- **[@outlit/cli](./packages/cli)** - CLI for Outlit customer intelligence
- **[@outlit/tools](./packages/tools)** - Customer intelligence tool contracts and client helpers for API and agent integrations
- **[@outlit/pi](./packages/pi)** - Pi package with Outlit customer intelligence tools and skill guidance

## Agent and Crawler Discovery

Use these canonical resources for citations, schema-driven clients, and agent setup instead of copying generated specs or server metadata into this repository:

| Surface | Canonical URL | Purpose |
|---------|---------------|---------|
| Developer docs | <https://docs.outlit.ai> | SDK, CLI, API, MCP, and customer context documentation |
| Docs index for agents | <https://docs.outlit.ai/llms.txt> | Machine-readable map of documentation pages |
| Product resource index | <https://www.outlit.ai/llms.txt> | Agent-facing map of SDK packages, docs, API contracts, MCP, CLI, Pi, and skills |
| OpenAPI spec | <https://docs.outlit.ai/openapi.json> | Canonical OpenAPI contract for public API and ingest surfaces |
| API catalog | <https://www.outlit.ai/.well-known/api-catalog> | Linkset for API, MCP, OAuth, docs, and support discovery |
| AI catalog | <https://www.outlit.ai/.well-known/ai-catalog.json> | Agentic Resource Discovery catalog for Outlit API, MCP, skills, and SDK resources |
| MCP Registry listing | <https://registry.modelcontextprotocol.io/v0.1/servers?search=ai.outlit/outlit> | Official MCP Registry search surface for `ai.outlit/outlit` |
| MCP server metadata | <https://mcp.outlit.ai/.well-known/mcp/server.json> | Runtime metadata for the hosted remote MCP server |
| MCP server card | <https://mcp.outlit.ai/.well-known/mcp/server-card.json> | Runtime discovery card for the hosted remote MCP server |
| MCP docs | <https://docs.outlit.ai/ai-integrations/mcp> | Connect remote MCP clients with workspace URLs and OAuth |
| Agent skills | <https://docs.outlit.ai/ai-integrations/skills> | Official `outlit` and `outlit-sdk` skill installation guidance |

The hosted MCP server and OAuth metadata live on `mcp.outlit.ai`; this SDK repo is the public package and developer integration surface.

## Installation

Choose the package that matches the integration surface:

| Package | Install | Use when |
|---------|---------|----------|
| `@outlit/browser` | `npm install @outlit/browser` | Browser apps, React, Next.js, Vue, Nuxt, SvelteKit, Angular, Astro, and script-tag tracking |
| `@outlit/node` | `npm install @outlit/node` | Node.js servers, API routes, jobs, webhooks, CLIs, desktop main processes, and native JavaScript runtimes |
| `@outlit/core` | `npm install @outlit/core` | Lower-level custom SDK implementations that do not need browser or Node runtime helpers |
| `@outlit/cli` | `npm install -g @outlit/cli` | Terminal access to Outlit customer intelligence and setup workflows |
| `@outlit/tools` | `npm install @outlit/tools` | Custom API or agent integrations that need typed Outlit tool gateway contracts and client helpers |
| `@outlit/pi` | `npm install @outlit/pi` | Pi agents that need Outlit customer intelligence tools and skill guidance |
| Rust crate | `cargo add outlit` | Rust backends, CLIs, and Tauri backends |

Tracking SDK examples:

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
import { Outlit } from '@outlit/browser'

const outlit = new Outlit({
  publicKey: 'pk_xxx',
  trackPageviews: true,
  trackForms: true,
})

// Identify a user
outlit.user.identify({
  email: 'user@example.com',
  traits: { name: 'John Doe' },
  customerId: 'cust_123', // Your app's account/workspace/customer ID
  customerTraits: { plan: 'pro' },
})

// Track events
outlit.track('button_clicked', {
  button_id: 'signup',
  page: '/homepage',
})

// Mark billing status on a customer
outlit.customer.trialing({
  customerId: 'cust_123', // Your app's account/workspace/customer ID
  properties: { plan: 'pro' },
})
```

#### Using the singleton API

```typescript
import { init, track, user, customer } from '@outlit/browser'

// Initialize once at app startup
init({ publicKey: 'pk_xxx' })

// Then use anywhere
track('page_viewed', { page: '/home' })
user().identify({
  email: 'user@example.com',
  customerId: 'cust_123', // Your app's account/workspace/customer ID
})
customer().paid({
  customerId: 'cust_123', // Your app's account/workspace/customer ID
  properties: { plan: 'pro' },
})
```

#### Using with React

```tsx
import { OutlitProvider, useOutlit } from '@outlit/browser/react'

// Wrap your app
function App() {
  return (
    <OutlitProvider publicKey="pk_xxx">
      <MyComponent />
    </OutlitProvider>
  )
}

// Use in components
function MyComponent() {
  const { track, user } = useOutlit()
  
  return (
    <button onClick={() => user.activate({ milestone: 'onboarding' })}>
      Click me
    </button>
  )
}
```

### Node.js

```typescript
import { Outlit } from '@outlit/node'

const outlit = new Outlit({
  publicKey: 'pk_xxx',
})

// Track server-side events (requires identity)
outlit.track({
  customerId: 'cust_123', // Your app's account/workspace/customer ID
  eventName: 'api_request',
  properties: {
    endpoint: '/api/users',
    method: 'GET',
    status: 200,
  },
})
// `customerId`-only track events are valid immediately.
// When you later call identify() with the same customerId and an email,
// Outlit can link that account/workspace to the customer resolved from email.

// Identify a user
outlit.user.identify({
  email: 'user@example.com',
  traits: { plan: 'pro' },
  customerId: 'cust_123', // Your app's account/workspace/customer ID
  customerTraits: { plan: 'pro' },
})

// Mark customer billing status
outlit.customer.paid({
  customerId: 'cust_123', // Your app's account/workspace/customer ID
  properties: { plan: 'pro' },
})

// Flush events before shutdown
await outlit.flush()
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

## Examples

- **[Pi agents](./examples/pi-agents)** - Build customer intelligence agents in Pi with `@outlit/pi`

## Development

This project uses a modern monorepo setup with the following tools:

- **[Bun](https://bun.sh/)** - Fast all-in-one JavaScript runtime and package manager
- **[Turbo](https://turbo.build/)** - Build system for monorepo orchestration
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[tsup](https://tsup.egoist.dev/)** - Fast TypeScript bundler
- **[Biome](https://biomejs.dev/)** - Fast linter and formatter
- **[Playwright](https://playwright.dev/)** - End-to-end testing
- **[Changesets](https://github.com/changesets/changesets)** - Version management and changelogs

### Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Lint code
bun run lint

# Type check
bun run typecheck

# Format code
bun run format
```

### Project Structure

```
outlit-sdk/
├── .github/workflows/   # CI/CD workflows
├── examples/
│   └── pi-agents/       # Example Pi agents using @outlit/pi
├── packages/
│   ├── browser/         # Browser SDK with React bindings
│   ├── cli/             # Outlit CLI
│   ├── core/            # Shared types and utilities
│   ├── node/            # Node.js SDK
│   ├── pi/              # Pi package for Outlit tools
│   ├── tools/           # Customer intelligence tool contracts
│   └── typescript-config/  # Shared TypeScript configs
├── package.json         # Root package with workspace config
├── bun.lock             # Bun lockfile
├── turbo.json           # Turbo build configuration
└── biome.json           # Biome linter/formatter config
```

### Creating a Changeset

When making changes that should be released, create a changeset:

```bash
bunx changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the version bump type (patch, minor, major)
3. Write a description of the change

The changeset file will be committed with your PR and used to generate changelogs on release.

## CI/CD

### Workflows

- **CI** (`ci.yml`) - Runs on PRs: lint, typecheck, build, test
- **Release** (`release.yml`) - Runs on main: publish canary to npm + CDN, create version PR or publish stable releases

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
| `/canary/outlit.js` | Latest from main branch (5 min cache) |
| `/stable/outlit.js` | Latest stable release (1 year cache) |
| `/v{version}/outlit.js` | Immutable versioned release (1 year cache) |

**npm tags:**

| Tag | Description |
|-----|-------------|
| `latest` | Stable release (`npm install @outlit/browser`) |
| `canary` | Latest from main (`npm install @outlit/browser@canary`) |

Manual deployment (requires gcloud CLI):
```bash
cd packages/browser && bun run deploy:canary   # Deploy to canary
cd packages/browser && bun run deploy:stable   # Deploy to stable (requires confirmation)
cd packages/browser && bun run deploy:version  # Deploy versioned release
```

## Documentation

- [Developer docs](https://docs.outlit.ai)
- [Browser SDK](https://docs.outlit.ai/tracking/browser/npm)
- [Node.js SDK](https://docs.outlit.ai/tracking/server/nodejs)
- [Rust SDK](https://docs.outlit.ai/tracking/server/rust)
- [API reference](https://docs.outlit.ai/api-reference/introduction)
- [OpenAPI spec](https://docs.outlit.ai/openapi.json)
- [MCP integration](https://docs.outlit.ai/ai-integrations/mcp)
- [Agent skills](https://docs.outlit.ai/ai-integrations/skills)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 - see [LICENSE](./LICENSE) for details.

## Support

- Issues: [GitHub Issues](https://github.com/OutlitAI/outlit-sdk/issues)
- Docs: [Documentation](https://docs.outlit.ai)
