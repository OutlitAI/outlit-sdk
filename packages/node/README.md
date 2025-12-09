# @outlit/node

Node.js SDK for Outlit events ingestion API. Track server-side events, user actions, and analytics in Node.js applications.

## Installation

```bash
npm install @outlit/node
```

## Usage

### Basic Setup

```typescript
import { OutlitNode } from '@outlit/node';

const outlit = new OutlitNode({
  apiKey: 'your-api-key',
  flushAt: 20,
  flushInterval: 10000,
  debug: true,
});
```

### Identify Users

```typescript
// Identify a user
outlit.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'enterprise',
});
```

### Track Events

```typescript
// Track server-side events
outlit.track('api_request', {
  endpoint: '/api/users',
  method: 'GET',
  status: 200,
});

// Track with context
outlit.trackServer('purchase_completed', 
  {
    product_id: 'prod-123',
    amount: 99.99,
    currency: 'USD',
  },
  {
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    url: '/checkout',
  }
);
```

### Express Middleware

```typescript
import express from 'express';
import { OutlitNode } from '@outlit/node';

const app = express();
const outlit = new OutlitNode({ apiKey: 'your-api-key' });

// Add middleware
app.use(outlit.createMiddleware());

// Use in routes
app.post('/api/users', (req, res) => {
  // Track event using the middleware
  req.outlit.track('user_created', {
    user_id: req.body.id,
    email: req.body.email,
  });
  
  res.json({ success: true });
});
```

### Graceful Shutdown

```typescript
// Automatic shutdown hooks are enabled by default
// Events are automatically flushed on SIGTERM, SIGINT, and beforeExit

// Manual shutdown
process.on('SIGTERM', async () => {
  await outlit.shutdown();
  process.exit(0);
});
```

## Features

- **Server-Side Event Tracking**: Track events from your Node.js backend
- **Context Enrichment**: Automatically enrich events with request context (IP, user agent, etc.)
- **Express Middleware**: Easy integration with Express and similar frameworks
- **Graceful Shutdown**: Automatically flush events before process exit
- **Event Queueing**: Queues events and flushes them in batches for efficiency
- **TypeScript Support**: Full TypeScript support with type definitions

## Configuration

All configuration options from `@outlit/core` are supported, plus:

- `enableShutdownHooks` (optional): Automatically flush events on shutdown (default: true)

## Node.js Support

- Node.js 18+
- CommonJS and ES Modules support

## License

Apache-2.0
