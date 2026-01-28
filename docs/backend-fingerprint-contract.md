# Backend Fingerprint Contract

This document describes the API payload changes for fingerprint support and the expected backend behavior.

## Overview

The `fingerprint` field enables anonymous event tracking that can be linked to users later when their email is known. This allows SDK users to track events before user sign-in and retroactively associate them with the user.

## Terminology

| Field | Purpose | Resolution |
|-------|---------|------------|
| `fingerprint` | Device identifier | Stored for backfill when email is provided via `identify()` |
| `userId` | App's internal user ID | Stored for backfill when email is provided |
| `email` | User's email address | Definitive identity - resolves immediately to CustomerContact |

## Payload Changes

### Track Endpoint: `POST /api/i/v1/{publicKey}/events`

#### IngestPayload

```typescript
interface IngestPayload {
  source: 'server';
  visitorId?: string;      // Optional for server events
  fingerprint?: string;    // NEW: Device identifier
  events: TrackerEvent[];
  sessionId?: string;      // Browser SDK only
  userIdentity?: {         // Browser SDK only
    email?: string;
    userId?: string;
  };
}
```

#### CustomEvent (properties)

The SDK includes identity fields in event properties for server-side resolution:

```typescript
interface CustomEventProperties {
  __fingerprint?: string | null;  // NEW
  __email?: string | null;
  __userId?: string | null;
  // ... other user-defined properties
}
```

### Identify Endpoint (via events)

#### IdentifyEvent

```typescript
interface IdentifyEvent {
  type: 'identify';
  timestamp: number;
  url: string;
  path: string;
  email: string;           // Required for identify
  userId?: string;
  fingerprint?: string;    // NEW: Device to link
  traits?: Record<string, unknown>;
}
```

## Expected Backend Behavior

### 1. Track Events without email

When receiving a track event with only `fingerprint` and/or `userId` (no email):

```json
{
  "source": "server",
  "events": [{
    "type": "custom",
    "eventName": "page_view",
    "properties": {
      "__fingerprint": "device_abc123",
      "__email": null,
      "__userId": null,
      "page": "/pricing"
    }
  }]
}
```

**Expected behavior:**
- Store the event as pending/unresolved
- Event should NOT be associated with any CustomerContact yet
- Event should be queryable by fingerprint/userId for later backfill

### 2. Track Events with email

When receiving a track event with `email` (plus optional fingerprint/userId):

```json
{
  "source": "server",
  "events": [{
    "type": "custom",
    "eventName": "signup_complete",
    "properties": {
      "__fingerprint": "device_abc123",
      "__email": "user@example.com",
      "__userId": null,
      "plan": "pro"
    }
  }]
}
```

**Expected behavior:**
- Resolve immediately to CustomerContact via email
- Store identity mappings (fingerprint→email, userId→email)
- **Backfill:** Find all unresolved events with matching `fingerprint` or `userId` and associate them with this CustomerContact

> **Note:** Backfill happens on ANY event that pairs email with fingerprint/userId. If the user provides both, they intend to link them.

### 3. Identify with fingerprint

When receiving an identify event with email + fingerprint:

```json
{
  "source": "server",
  "events": [{
    "type": "identify",
    "email": "user@example.com",
    "fingerprint": "device_abc123",
    "userId": "usr_123",
    "traits": { "name": "John Doe" }
  }]
}
```

**Expected behavior:**
- Same as track with email + fingerprint/userId (backfill pending events)
- Additionally: update CustomerContact with provided `traits`

### 4. Mapping Storage

The backend should maintain mappings:

```
fingerprint -> email (definitive)
userId -> email (definitive)
```

These mappings should be:
- Project-scoped (fingerprints are unique within a project)
- Immutable once established (a fingerprint maps to one email forever)
- Used for real-time resolution of future events

## Identity Resolution Priority

When resolving events, use this priority:

1. **email** - Immediate resolution to CustomerContact
2. **userId** - Check userId->email mapping, if found resolve to CustomerContact
3. **fingerprint** - Check fingerprint->email mapping, if found resolve to CustomerContact
4. **None** - Store as pending/unresolved (server events should always have at least one)

## Database Schema Suggestions

### New/Modified Tables

```sql
-- Store fingerprint->email mappings
CREATE TABLE identity_mappings (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  fingerprint VARCHAR(255),
  user_id VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, fingerprint),
  UNIQUE(project_id, user_id)
);

-- Modify events table to track pending events
ALTER TABLE customer_events
ADD COLUMN fingerprint VARCHAR(255),
ADD COLUMN pending_resolution BOOLEAN DEFAULT FALSE;
```

## Testing Checklist

- [ ] Track event with fingerprint only → stored as pending
- [ ] Track event with userId only → stored as pending
- [ ] Track event with email only → resolves immediately
- [ ] Track event with fingerprint + email → resolves + backfills fingerprint events
- [ ] Track event with userId + email → resolves + backfills userId events
- [ ] Identify with fingerprint + userId → backfills both
- [ ] Mappings are immutable (second event with different email doesn't change mapping)

## Migration Notes

- Existing events without fingerprint continue to work unchanged
- The fingerprint field is optional - backwards compatible
- No breaking changes to existing API consumers
