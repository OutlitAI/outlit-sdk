# @outlit/core

Core SDK for Outlit events ingestion API. This package provides the base functionality for tracking events and is used by platform-specific packages like `@outlit/browser` and `@outlit/node`.

## Installation

```bash
npm install @outlit/core
```

## Usage

```typescript
import { OutlitClient } from '@outlit/core';

const client = new OutlitClient({
  apiKey: 'your-api-key',
  flushAt: 20, // Flush after 20 events
  flushInterval: 10000, // Flush every 10 seconds
  debug: true, // Enable debug logging
});

// Identify a user
client.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
});

// Track an event
client.track('button_clicked', {
  button_id: 'signup',
  page: '/homepage',
});

// Flush events manually
await client.flush();

// Shutdown client (flushes remaining events)
await client.shutdown();
```

## Configuration

- `apiKey` (required): Your Outlit API key
- `apiUrl` (optional): Custom API endpoint (default: `https://api.outlit.ai/v1`)
- `flushAt` (optional): Number of events to trigger auto-flush (default: 20)
- `flushInterval` (optional): Milliseconds between auto-flushes (default: 10000)
- `maxQueueSize` (optional): Maximum events in queue (default: 100)
- `retryCount` (optional): Number of retry attempts (default: 3)
- `timeout` (optional): Request timeout in milliseconds (default: 5000)
- `debug` (optional): Enable debug logging (default: false)

## License

Apache-2.0
