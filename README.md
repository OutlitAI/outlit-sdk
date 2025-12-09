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

- 🚀 **Modern TypeScript** - Full TypeScript support with type definitions
- 📦 **Tree-shakeable** - Optimized bundle size with dual ESM/CJS exports
- 🔄 **Event Queueing** - Automatic batching and flushing of events
- 🌐 **Multi-platform** - Separate packages for browser and Node.js
- 🎯 **Auto-tracking** - Automatic page view tracking in browser
- 🔌 **Middleware Support** - Easy integration with Express and similar frameworks
- 💾 **Persistent Identity** - User and anonymous ID persistence
- ⚡ **High Performance** - Minimal overhead and efficient batching
- 🛡️ **Type Safe** - Full TypeScript support with strict types

## Development

This project uses a modern monorepo setup with the following tools:

- **[Turbo](https://turbo.build/)** - Build system for monorepo orchestration
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[tsup](https://tsup.egoist.dev/)** - Fast TypeScript bundler
- **[Vitest](https://vitest.dev/)** - Fast unit test framework
- **[ESLint](https://eslint.org/)** & **[Prettier](https://prettier.io/)** - Code quality and formatting
- **[Changesets](https://github.com/changesets/changesets)** - Version management and changelogs

### Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
outlit-sdk/
├── packages/
│   ├── core/          # Core SDK functionality
│   ├── browser/       # Browser-specific SDK
│   └── node/          # Node.js SDK
├── package.json       # Root package with workspace config
├── turbo.json         # Turbo build configuration
└── tsconfig.json      # Shared TypeScript config
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

- 📧 Email: support@outlit.ai
- 🐛 Issues: [GitHub Issues](https://github.com/OutlitAI/outlit-sdk/issues)
- 📖 Docs: [Documentation](https://docs.outlit.ai)