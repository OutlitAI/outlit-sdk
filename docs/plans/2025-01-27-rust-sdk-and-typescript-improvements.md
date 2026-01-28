# Outlit Rust SDK & TypeScript Improvements Design

## Overview

This document outlines the design for:
1. A new Rust SDK (`outlit`) for server-side event tracking
2. TypeScript typing improvements for the existing Node/Browser SDKs

---

## Part 1: Rust SDK

### Project Structure

```
outlit-sdk/
├── packages/                    # Existing TS packages (unchanged)
│   ├── browser/
│   ├── node/
│   └── core/
├── crates/
│   └── outlit/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs           # Public API, re-exports
│           ├── client.rs        # Outlit client struct
│           ├── config.rs        # OutlitConfig, builder
│           ├── types.rs         # Event types, Identity helpers
│           ├── queue.rs         # Event batching & flush
│           ├── transport.rs     # HTTP client (reqwest)
│           └── error.rs         # OutlitError (thiserror)
├── Cargo.toml                   # Workspace root
├── package.json                 # Existing
└── pnpm-workspace.yaml          # Existing
```

### Dependencies

```toml
[dependencies]
tokio = { version = "1", features = ["rt", "time", "sync"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tracing = "0.1"
```

### Public API

#### Client Initialization (Builder Pattern)

```rust
use outlit::Outlit;
use std::time::Duration;

let client = Outlit::builder("pk_xxx")
    .api_host("https://custom.example.com")
    .flush_interval(Duration::from_secs(5))
    .max_batch_size(50)
    .timeout(Duration::from_secs(30))
    .build()?;
```

#### Identity Helpers (Compile-Time Safety)

```rust
use outlit::{email, user_id};

// These ensure identity is always provided - no runtime errors
email("user@example.com")  // -> Email newtype
user_id("usr_123")         // -> UserId newtype
```

#### Track Custom Events

```rust
// With email
client.track("feature_used", email("user@example.com"))
    .property("feature", "export")
    .property("count", 5)
    .send()
    .await?;

// With user_id
client.track("purchase", user_id("usr_123"))
    .property("amount", 99.99)
    .send()
    .await?;

// Can add the other identifier optionally
client.track("signup", email("user@example.com"))
    .user_id("usr_123")
    .property("source", "google")
    .send()
    .await?;
```

#### Identify (Update User Traits)

Unlike the browser SDK which links anonymous visitors to users, the Rust SDK's
`identify()` is for updating user data when your app learns new information
about them (login, settings change, etc.)

```rust
client.identify(email("user@example.com"))
    .user_id("usr_123")
    .trait_("name", "John Doe")
    .trait_("plan", "pro")
    .send()
    .await?;
```

#### User Journey Stages

```rust
client.user().activate(email("user@example.com"))
    .property("source", "onboarding")
    .send()
    .await?;

client.user().engaged(user_id("usr_123"))
    .send()
    .await?;

client.user().inactive(email("user@example.com"))
    .send()
    .await?;
```

#### Customer Billing (Domain Required)

```rust
client.customer().paid("acme.com")
    .customer_id("cust_123")
    .stripe_customer_id("cus_xxx")
    .property("plan", "enterprise")
    .send()
    .await?;

client.customer().trialing("startup.io")
    .send()
    .await?;

client.customer().churned("example.com")
    .property("reason", "pricing")
    .send()
    .await?;
```

#### Lifecycle

```rust
client.flush().await?;    // Force flush pending events
client.shutdown().await?; // Flush + stop background tasks
```

### Error Handling

Using `thiserror` for clean error types:

```rust
#[derive(Debug, thiserror::Error)]
pub enum OutlitError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Invalid configuration: {0}")]
    Config(String),

    #[error("Client has been shutdown")]
    Shutdown,

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
```

All public methods return `Result<(), OutlitError>`.

### Logging

Using `tracing` crate for observability:

```rust
use tracing::{info, warn, instrument};

#[instrument(skip(self))]
pub async fn flush(&self) -> Result<(), OutlitError> {
    info!(event_count = events.len(), "flushing events");
    // ...
}
```

Consumers configure their own tracing subscriber.

### Payload Structure (Identical to Node SDK)

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestPayload {
    pub source: String,            // "server"
    pub events: Vec<TrackerEvent>,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TrackerEvent {
    #[serde(rename = "custom")]
    Custom { /* fields */ },
    #[serde(rename = "identify")]
    Identify { /* fields */ },
    #[serde(rename = "stage")]
    Stage { /* fields */ },
    #[serde(rename = "billing")]
    Billing { /* fields */ },
}
```

All fields use `#[serde(rename_all = "camelCase")]` to match Node SDK JSON output.

### Publishing

- Publish to crates.io as `outlit`
- GitHub Actions workflow triggered on tags like `rust-v0.1.0`
- Independent versioning from npm packages

---

## Part 2: TypeScript Improvements

### New Interfaces

Add to `packages/core/src/types.ts`:

```typescript
/**
 * Customer-level traits that can be nested under `customer` in identify.
 * These are applied to the customer/account, not the individual user.
 */
export interface CustomerTraits {
  /** Customer's billing plan */
  plan?: string
  /** Allow additional custom properties */
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Traits for identify calls, supporting both user-level
 * and nested customer-level properties.
 */
export interface IdentifyTraits {
  /** Nested customer/account-level traits */
  customer?: CustomerTraits
  /** User-level traits */
  [key: string]: string | number | boolean | null | CustomerTraits | undefined
}
```

### Updated Options

```typescript
export interface ServerIdentifyOptions extends ServerIdentity {
  traits?: IdentifyTraits  // was: Record<string, string | number | boolean | null>
}

export interface BrowserIdentifyOptions {
  email?: string
  userId?: string
  traits?: IdentifyTraits  // was: Record<string, string | number | boolean | null>
}
```

### Files to Change

| File | Change |
|------|--------|
| `packages/core/src/types.ts` | Add `CustomerTraits`, `IdentifyTraits`, update options |
| `packages/node/src/client.ts` | Import updated types (no code changes needed) |
| `packages/browser/src/tracker.ts` | Import updated types (no code changes needed) |

### Non-Breaking

Existing code using flat traits continues to work. The new `customer` field is optional.

---

## Implementation Checklist

### Rust SDK

- [ ] Create `crates/outlit/` directory structure
- [ ] Add root `Cargo.toml` workspace configuration
- [ ] Implement `OutlitError` with thiserror
- [ ] Implement `Email` and `UserId` identity newtypes
- [ ] Implement client builder (`Outlit::builder()`)
- [ ] Implement event builders (track, identify, stage, billing)
- [ ] Implement `EventQueue` with batching
- [ ] Implement `HttpTransport` with reqwest
- [ ] Implement background flush timer with tokio
- [ ] Add `flush()` and `shutdown()` lifecycle methods
- [ ] Add tracing instrumentation
- [ ] Write unit tests for serialization (verify camelCase output)
- [ ] Write integration tests
- [ ] Set up GitHub Actions for crates.io publishing
- [ ] Add README and documentation

### TypeScript Improvements

- [ ] Add `CustomerTraits` interface
- [ ] Add `IdentifyTraits` interface
- [ ] Update `ServerIdentifyOptions.traits` type
- [ ] Update `BrowserIdentifyOptions.traits` type
- [ ] Verify no breaking changes with existing tests

---

## Testing Plan

### Rust SDK Tests

#### 1. Unit Tests (`crates/outlit/src/` - inline or `tests/` module)

**Serialization Tests (Critical - ensures parity with Node SDK)**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_custom_event_serialization() {
        let event = CustomEvent {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            event_name: "signup".into(),
            properties: Some(hashmap!{ "plan" => "pro" }),
        };
        let json = serde_json::to_value(&event).unwrap();

        // Verify camelCase
        assert!(json.get("eventName").is_some());
        assert!(json.get("event_name").is_none());
        assert_eq!(json["type"], "custom");
    }

    #[test]
    fn test_identify_event_serialization() {
        let event = IdentifyEvent {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            email: Some("user@example.com".into()),
            user_id: Some("usr_123".into()),
            traits: Some(hashmap!{ "name" => "John" }),
        };
        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "identify");
        assert!(json.get("userId").is_some());  // camelCase
    }

    #[test]
    fn test_stage_event_serialization() {
        let event = StageEvent {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            stage: "activated".into(),
            properties: None,
        };
        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "stage");
        assert_eq!(json["stage"], "activated");
    }

    #[test]
    fn test_billing_event_serialization() {
        let event = BillingEvent {
            timestamp: 1706400000000,
            url: "server://acme.com".into(),
            path: "/".into(),
            status: "paid".into(),
            domain: Some("acme.com".into()),
            customer_id: Some("cust_123".into()),
            stripe_customer_id: Some("cus_xxx".into()),
            properties: None,
        };
        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "billing");
        assert!(json.get("customerId").is_some());      // camelCase
        assert!(json.get("stripeCustomerId").is_some()); // camelCase
    }

    #[test]
    fn test_ingest_payload_structure() {
        let payload = IngestPayload {
            source: "server".into(),
            events: vec![/* events */],
        };
        let json = serde_json::to_value(&payload).unwrap();

        assert_eq!(json["source"], "server");
        assert!(json["events"].is_array());
        // visitorId should NOT be present for server events
        assert!(json.get("visitorId").is_none());
    }

    #[test]
    fn test_optional_fields_omitted_when_none() {
        let event = CustomEvent {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            event_name: "test".into(),
            properties: None,  // should be omitted, not null
        };
        let json_str = serde_json::to_string(&event).unwrap();

        assert!(!json_str.contains("properties"));
    }
}
```

**Builder Tests**

```rust
#[test]
fn test_client_builder_defaults() {
    let client = Outlit::builder("pk_test").build().unwrap();

    assert_eq!(client.config().api_host(), "https://app.outlit.ai");
    assert_eq!(client.config().flush_interval(), Duration::from_secs(10));
    assert_eq!(client.config().max_batch_size(), 100);
    assert_eq!(client.config().timeout(), Duration::from_secs(10));
}

#[test]
fn test_client_builder_custom_values() {
    let client = Outlit::builder("pk_test")
        .api_host("https://custom.example.com")
        .flush_interval(Duration::from_secs(5))
        .max_batch_size(50)
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap();

    assert_eq!(client.config().api_host(), "https://custom.example.com");
    assert_eq!(client.config().flush_interval(), Duration::from_secs(5));
}

#[test]
fn test_client_builder_requires_public_key() {
    let result = Outlit::builder("").build();
    assert!(result.is_err());
}

#[test]
fn test_track_builder_with_email() {
    // Compiles - email provided
    let _builder = client.track("event", email("user@example.com"));
}

#[test]
fn test_track_builder_with_user_id() {
    // Compiles - user_id provided
    let _builder = client.track("event", user_id("usr_123"));
}

#[test]
fn test_track_builder_properties() {
    let builder = client.track("event", email("user@example.com"))
        .property("string", "value")
        .property("number", 42)
        .property("float", 3.14)
        .property("bool", true);

    // Properties should be collected
    assert_eq!(builder.properties().len(), 4);
}
```

**Identity Tests**

```rust
#[test]
fn test_email_newtype() {
    let e = email("user@example.com");
    assert_eq!(e.as_str(), "user@example.com");
}

#[test]
fn test_user_id_newtype() {
    let id = user_id("usr_123");
    assert_eq!(id.as_str(), "usr_123");
}

#[test]
fn test_identity_into_string() {
    let e: String = email("test@example.com").into();
    assert_eq!(e, "test@example.com");
}
```

**Queue Tests**

```rust
#[tokio::test]
async fn test_queue_batches_events() {
    let queue = EventQueue::new(10);  // batch size 10

    for i in 0..5 {
        queue.enqueue(make_test_event(i)).await;
    }

    assert_eq!(queue.len().await, 5);
    assert!(!queue.should_flush().await);  // not at batch size yet
}

#[tokio::test]
async fn test_queue_triggers_flush_at_batch_size() {
    let queue = EventQueue::new(10);

    for i in 0..10 {
        queue.enqueue(make_test_event(i)).await;
    }

    assert!(queue.should_flush().await);
}

#[tokio::test]
async fn test_queue_drain() {
    let queue = EventQueue::new(100);

    for i in 0..5 {
        queue.enqueue(make_test_event(i)).await;
    }

    let events = queue.drain().await;
    assert_eq!(events.len(), 5);
    assert_eq!(queue.len().await, 0);
}
```

**Error Tests**

```rust
#[test]
fn test_error_display() {
    let err = OutlitError::Config("missing public key".into());
    assert_eq!(err.to_string(), "Invalid configuration: missing public key");
}

#[test]
fn test_error_from_reqwest() {
    // Verify From trait implementation
    let reqwest_err: Result<(), reqwest::Error> = Err(/* mock */);
    let outlit_err: Result<(), OutlitError> = reqwest_err.map_err(Into::into);
    assert!(matches!(outlit_err, Err(OutlitError::Http(_))));
}
```

#### 2. Integration Tests (`crates/outlit/tests/`)

**Mock Server Tests**

```rust
// tests/integration.rs
use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, path, body_json};

#[tokio::test]
async fn test_track_sends_correct_payload() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/i/v1/pk_test/events"))
        .and(body_json(json!({
            "source": "server",
            "events": [{
                "type": "custom",
                "eventName": "test_event",
                // ... other fields
            }]
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .build()
        .unwrap();

    client.track("test_event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_flush_on_shutdown() {
    let mock_server = MockServer::start().await;

    let received = Arc::new(AtomicBool::new(false));
    let received_clone = received.clone();

    Mock::given(method("POST"))
        .respond_with_fn(move |_| {
            received_clone.store(true, Ordering::SeqCst);
            ResponseTemplate::new(200).set_body_json(json!({
                "success": true, "processed": 1
            }))
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .build()
        .unwrap();

    client.track("event", email("user@test.com")).send().await.unwrap();
    client.shutdown().await.unwrap();

    assert!(received.load(Ordering::SeqCst));
}

#[tokio::test]
async fn test_retry_on_failure() {
    let mock_server = MockServer::start().await;
    let attempt_count = Arc::new(AtomicUsize::new(0));
    let count_clone = attempt_count.clone();

    Mock::given(method("POST"))
        .respond_with_fn(move |_| {
            let count = count_clone.fetch_add(1, Ordering::SeqCst);
            if count < 2 {
                ResponseTemplate::new(500)
            } else {
                ResponseTemplate::new(200).set_body_json(json!({
                    "success": true, "processed": 1
                }))
            }
        })
        .mount(&mock_server)
        .await;

    // Test that client retries on 5xx errors
    // ...
}

#[tokio::test]
async fn test_handles_partial_failure_response() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 2,
            "errors": [
                { "index": 1, "message": "Invalid event" }
            ]
        })))
        .mount(&mock_server)
        .await;

    // Verify client logs/handles partial failures appropriately
    // ...
}
```

**Concurrency Tests**

```rust
#[tokio::test]
async fn test_concurrent_track_calls() {
    let client = Arc::new(Outlit::builder("pk_test").build().unwrap());

    let mut handles = vec![];
    for i in 0..100 {
        let client = client.clone();
        handles.push(tokio::spawn(async move {
            client.track(&format!("event_{}", i), email("user@test.com"))
                .send()
                .await
        }));
    }

    for handle in handles {
        handle.await.unwrap().unwrap();
    }

    // All events should be queued
    assert!(client.pending_event_count().await >= 100);
}
```

#### 3. Cross-SDK Parity Tests

```rust
// tests/parity.rs
// These tests verify Rust SDK produces identical JSON to Node SDK

#[test]
fn test_payload_matches_node_sdk_output() {
    // Load expected JSON from fixtures (captured from Node SDK)
    let expected: Value = serde_json::from_str(include_str!(
        "fixtures/node_sdk_track_payload.json"
    )).unwrap();

    let rust_event = CustomEvent { /* ... */ };
    let rust_payload = IngestPayload {
        source: "server".into(),
        events: vec![TrackerEvent::Custom(rust_event)],
    };
    let actual = serde_json::to_value(&rust_payload).unwrap();

    assert_eq!(actual, expected);
}
```

### TypeScript SDK Tests

#### 1. Type Tests (`packages/core/src/__tests__/types.test.ts`)

```typescript
import { expectTypeOf } from 'vitest';
import type {
  IdentifyTraits,
  CustomerTraits,
  ServerIdentifyOptions,
  BrowserIdentifyOptions
} from '../types';

describe('IdentifyTraits types', () => {
  it('accepts flat traits', () => {
    const traits: IdentifyTraits = {
      name: 'John',
      age: 30,
      active: true,
    };
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>();
  });

  it('accepts nested customer traits', () => {
    const traits: IdentifyTraits = {
      name: 'John',
      customer: {
        plan: 'enterprise',
        seats: 50,
      },
    };
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>();
  });

  it('allows custom customer properties', () => {
    const traits: IdentifyTraits = {
      customer: {
        plan: 'pro',
        customField: 'value',
        numericField: 123,
      },
    };
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>();
  });
});

describe('ServerIdentifyOptions', () => {
  it('accepts IdentifyTraits', () => {
    const options: ServerIdentifyOptions = {
      email: 'user@example.com',
      traits: {
        name: 'John',
        customer: { plan: 'pro' },
      },
    };
    expectTypeOf(options).toMatchTypeOf<ServerIdentifyOptions>();
  });
});

describe('BrowserIdentifyOptions', () => {
  it('accepts IdentifyTraits', () => {
    const options: BrowserIdentifyOptions = {
      email: 'user@example.com',
      traits: {
        name: 'John',
        customer: { plan: 'pro' },
      },
    };
    expectTypeOf(options).toMatchTypeOf<BrowserIdentifyOptions>();
  });
});
```

#### 2. Runtime Tests (`packages/node/src/__tests__/client.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutlitNode } from '../client';

describe('identify with CustomerTraits', () => {
  let client: OutlitNode;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 1 }),
    });
    global.fetch = mockFetch;

    client = new OutlitNode({ publicKey: 'pk_test' });
  });

  it('sends flat traits correctly', async () => {
    await client.identify({
      email: 'user@example.com',
      traits: { name: 'John', role: 'admin' },
    });
    await client.flush();

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(payload.events[0].traits).toEqual({
      name: 'John',
      role: 'admin',
    });
  });

  it('sends nested customer traits correctly', async () => {
    await client.identify({
      email: 'user@example.com',
      traits: {
        name: 'John',
        customer: {
          plan: 'enterprise',
          seats: 50,
        },
      },
    });
    await client.flush();

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(payload.events[0].traits).toEqual({
      name: 'John',
      customer: {
        plan: 'enterprise',
        seats: 50,
      },
    });
  });

  it('handles null trait values', async () => {
    await client.identify({
      email: 'user@example.com',
      traits: {
        name: 'John',
        removedField: null,
      },
    });
    await client.flush();

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(payload.events[0].traits.removedField).toBeNull();
  });
});
```

#### 3. Backward Compatibility Tests

```typescript
describe('backward compatibility', () => {
  it('existing code without customer field still works', async () => {
    // This is the OLD usage pattern - must still work
    await client.identify({
      email: 'user@example.com',
      traits: {
        name: 'John',
        company: 'Acme',  // flat string, not nested
      },
    });

    // Should not throw, should work exactly as before
    await client.flush();
    expect(mockFetch).toHaveBeenCalled();
  });
});
```

### Test Dependencies

**Rust:**
```toml
[dev-dependencies]
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
wiremock = "0.6"
serde_json = "1"
```

**TypeScript:**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "expectTypeOf": "^0.17.0"
  }
}
```

### CI Integration

**Rust tests in GitHub Actions:**
```yaml
- name: Run Rust tests
  run: cargo test --all-features
  working-directory: crates/outlit

- name: Run Rust integration tests
  run: cargo test --test integration
  working-directory: crates/outlit
```

**TypeScript tests:**
```yaml
- name: Run TypeScript tests
  run: pnpm test
```

---

## Open Decisions

1. **Rust MSRV (Minimum Supported Rust Version)** - Suggest 1.75+ for async trait stability
2. **Feature flags** - Consider `blocking` feature for sync API (like reqwest does)
