# @outlit/browser

Browser SDK for Outlit events ingestion API. Track user interactions, page views, and custom events in web applications.

## Installation

```bash
npm install @outlit/browser
```

## Usage

### Basic Setup

```typescript
import { OutlitBrowser } from '@outlit/browser';

const outlit = new OutlitBrowser({
  apiKey: 'your-api-key',
  autoPageViews: true, // Automatically track page views
  debug: true,
});
```

### Identify Users

```typescript
// Identify a user
outlit.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'premium',
});
```

### Track Events

```typescript
// Track custom events
outlit.track('button_clicked', {
  button_id: 'signup',
  page: '/homepage',
  variant: 'primary',
});

outlit.track('form_submitted', {
  form_name: 'contact',
  fields: ['name', 'email', 'message'],
});
```

### Manual Page Views

```typescript
// Track page views manually (if autoPageViews is disabled)
outlit.pageView({
  custom_property: 'value',
});
```

## Features

- **Automatic Page View Tracking**: Tracks page views automatically, including SPA navigation
- **Anonymous User Tracking**: Automatically generates and persists anonymous IDs
- **UTM Parameter Capture**: Captures UTM parameters from URLs
- **LocalStorage Persistence**: Persists user IDs and anonymous IDs across sessions
- **Event Queueing**: Queues events and flushes them in batches for efficiency
- **TypeScript Support**: Full TypeScript support with type definitions

## Configuration

All configuration options from `@outlit/core` are supported, plus:

- `autoPageViews` (optional): Automatically track page views (default: true)
- `capturePageTitle` (optional): Include page title in page views (default: true)
- `captureReferrer` (optional): Include referrer in page views (default: true)
- `captureUtmParams` (optional): Capture UTM parameters (default: true)

## Browser Support

- Chrome, Firefox, Safari, Edge (latest 2 versions)
- Requires ES2020 support
- LocalStorage must be available

## License

Apache-2.0
