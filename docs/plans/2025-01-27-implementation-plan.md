# Outlit Rust SDK & TypeScript Improvements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Rust SDK for server-side event tracking and add typed CustomerTraits to the TypeScript SDK.

**Architecture:** The Rust SDK uses builder patterns for ergonomic API, compiles to a single crate (`outlit`), and produces identical JSON payloads to the Node SDK. TypeScript changes add optional nested `customer` traits without breaking existing usage.

**Tech Stack:** Rust (tokio, reqwest, serde, thiserror, tracing), TypeScript (existing vitest setup)

---

## Part 1: TypeScript Improvements

### Task 1: Add CustomerTraits and IdentifyTraits Types

**Files:**
- Modify: `packages/core/src/types.ts`

**Step 1: Write the type test**

Create `packages/core/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest'
import type {
  CustomerTraits,
  IdentifyTraits,
  ServerIdentifyOptions,
  BrowserIdentifyOptions,
} from '../types'

describe('CustomerTraits', () => {
  it('accepts plan property', () => {
    const traits: CustomerTraits = { plan: 'enterprise' }
    expectTypeOf(traits).toMatchTypeOf<CustomerTraits>()
  })

  it('accepts custom properties', () => {
    const traits: CustomerTraits = {
      plan: 'pro',
      seats: 50,
      active: true,
    }
    expectTypeOf(traits).toMatchTypeOf<CustomerTraits>()
  })
})

describe('IdentifyTraits', () => {
  it('accepts flat traits (backward compat)', () => {
    const traits: IdentifyTraits = {
      name: 'John',
      age: 30,
    }
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>()
  })

  it('accepts nested customer traits', () => {
    const traits: IdentifyTraits = {
      name: 'John',
      customer: {
        plan: 'enterprise',
        seats: 50,
      },
    }
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>()
  })
})

describe('ServerIdentifyOptions', () => {
  it('accepts IdentifyTraits in traits field', () => {
    const options: ServerIdentifyOptions = {
      email: 'user@example.com',
      traits: {
        name: 'John',
        customer: { plan: 'pro' },
      },
    }
    expectTypeOf(options).toMatchTypeOf<ServerIdentifyOptions>()
  })
})

describe('BrowserIdentifyOptions', () => {
  it('accepts IdentifyTraits in traits field', () => {
    const options: BrowserIdentifyOptions = {
      email: 'user@example.com',
      traits: {
        name: 'John',
        customer: { plan: 'pro' },
      },
    }
    expectTypeOf(options).toMatchTypeOf<BrowserIdentifyOptions>()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test`

Expected: FAIL - `CustomerTraits` and `IdentifyTraits` not exported

**Step 3: Add the new interfaces to types.ts**

In `packages/core/src/types.ts`, add after the `ServerIdentity` interface (around line 74):

```typescript
// ============================================
// IDENTIFY TRAITS (with optional customer nesting)
// ============================================

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

**Step 4: Update ServerIdentifyOptions**

Change:
```typescript
export interface ServerIdentifyOptions extends ServerIdentity {
  traits?: Record<string, string | number | boolean | null>
}
```

To:
```typescript
export interface ServerIdentifyOptions extends ServerIdentity {
  traits?: IdentifyTraits
}
```

**Step 5: Update BrowserIdentifyOptions**

Change:
```typescript
export interface BrowserIdentifyOptions {
  email?: string
  userId?: string
  traits?: Record<string, string | number | boolean | null>
}
```

To:
```typescript
export interface BrowserIdentifyOptions {
  email?: string
  userId?: string
  traits?: IdentifyTraits
}
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/core && pnpm test`

Expected: PASS

**Step 7: Run full test suite for regression**

Run: `pnpm test`

Expected: All tests pass (no breaking changes)

**Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/__tests__/types.test.ts
git commit -m "feat(core): add CustomerTraits and IdentifyTraits for nested customer properties"
```

---

## Part 2: Rust SDK

### Task 2: Set Up Rust Workspace

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `crates/outlit/Cargo.toml`
- Create: `crates/outlit/src/lib.rs`
- Modify: `.gitignore`

**Step 1: Create workspace root Cargo.toml**

Create `Cargo.toml` in repo root:

```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "MIT"
repository = "https://github.com/anthropics/outlit-sdk"
rust-version = "1.75"

[workspace.dependencies]
tokio = { version = "1", features = ["rt", "time", "sync", "macros"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tracing = "0.1"
```

**Step 2: Create crate Cargo.toml**

Create `crates/outlit/Cargo.toml`:

```toml
[package]
name = "outlit"
version.workspace = true
edition.workspace = true
license.workspace = true
repository.workspace = true
rust-version.workspace = true
description = "Outlit analytics SDK for Rust"
keywords = ["analytics", "tracking", "outlit"]
categories = ["api-bindings", "development-tools"]

[dependencies]
tokio = { workspace = true }
reqwest = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }

[dev-dependencies]
tokio = { workspace = true, features = ["rt-multi-thread", "macros"] }
wiremock = "0.6"
```

**Step 3: Create initial lib.rs**

Create `crates/outlit/src/lib.rs`:

```rust
//! Outlit analytics SDK for Rust.
//!
//! # Example
//!
//! ```rust,no_run
//! use outlit::{Outlit, email};
//! use std::time::Duration;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), outlit::Error> {
//!     let client = Outlit::builder("pk_xxx")
//!         .flush_interval(Duration::from_secs(5))
//!         .build()?;
//!
//!     client.track("signup", email("user@example.com"))
//!         .property("plan", "pro")
//!         .send()
//!         .await?;
//!
//!     client.shutdown().await?;
//!     Ok(())
//! }
//! ```

mod error;

pub use error::Error;

/// Placeholder - will be implemented in subsequent tasks
pub struct Outlit;

impl Outlit {
    pub fn builder(_public_key: &str) -> OutlitBuilder {
        OutlitBuilder
    }
}

pub struct OutlitBuilder;

impl OutlitBuilder {
    pub fn build(self) -> Result<Outlit, Error> {
        Ok(Outlit)
    }
}

/// Create an email identity.
pub fn email(e: impl Into<String>) -> Email {
    Email(e.into())
}

/// Create a user ID identity.
pub fn user_id(id: impl Into<String>) -> UserId {
    UserId(id.into())
}

/// Email identity wrapper.
#[derive(Debug, Clone)]
pub struct Email(pub(crate) String);

impl Email {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// User ID identity wrapper.
#[derive(Debug, Clone)]
pub struct UserId(pub(crate) String);

impl UserId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}
```

**Step 4: Create error.rs**

Create `crates/outlit/src/error.rs`:

```rust
//! Error types for the Outlit SDK.

/// Errors that can occur when using the Outlit SDK.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// HTTP request failed.
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// Invalid configuration.
    #[error("Invalid configuration: {0}")]
    Config(String),

    /// Client has been shutdown.
    #[error("Client has been shutdown")]
    Shutdown,

    /// Serialization error.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
```

**Step 5: Update .gitignore**

Add to `.gitignore`:

```
# Rust
/target/
Cargo.lock
```

**Step 6: Verify it compiles**

Run: `cargo check`

Expected: Compiles successfully

**Step 7: Run cargo test (empty for now)**

Run: `cargo test`

Expected: PASS (no tests yet, but compiles)

**Step 8: Commit**

```bash
git add Cargo.toml crates/ .gitignore
git commit -m "feat(rust): set up Rust workspace and outlit crate scaffold"
```

---

### Task 3: Implement Types and Serialization

**Files:**
- Create: `crates/outlit/src/types.rs`
- Modify: `crates/outlit/src/lib.rs`

**Step 1: Write serialization tests**

Create `crates/outlit/src/types.rs`:

```rust
//! Event types and serialization.

use serde::Serialize;
use std::collections::HashMap;

/// Source type for events.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Server,
}

/// Journey stage values.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum JourneyStage {
    Activated,
    Engaged,
    Inactive,
}

/// Billing status values.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BillingStatus {
    Trialing,
    Paid,
    Churned,
}

/// Custom event data.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomEventData {
    pub timestamp: i64,
    pub url: String,
    pub path: String,
    pub event_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, serde_json::Value>>,
}

/// Identify event data.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentifyEventData {
    pub timestamp: i64,
    pub url: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub traits: Option<HashMap<String, serde_json::Value>>,
}

/// Stage event data.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageEventData {
    pub timestamp: i64,
    pub url: String,
    pub path: String,
    pub stage: JourneyStage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, serde_json::Value>>,
}

/// Billing event data.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingEventData {
    pub timestamp: i64,
    pub url: String,
    pub path: String,
    pub status: BillingStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stripe_customer_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, serde_json::Value>>,
}

/// All event types.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TrackerEvent {
    #[serde(rename = "custom")]
    Custom(CustomEventData),
    #[serde(rename = "identify")]
    Identify(IdentifyEventData),
    #[serde(rename = "stage")]
    Stage(StageEventData),
    #[serde(rename = "billing")]
    Billing(BillingEventData),
}

/// Payload sent to the ingest API.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestPayload {
    pub source: SourceType,
    pub events: Vec<TrackerEvent>,
}

/// Response from the ingest API.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub success: bool,
    pub processed: u32,
    #[serde(default)]
    pub errors: Option<Vec<IngestError>>,
}

/// Error from the ingest API.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestError {
    pub index: usize,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_custom_event_camel_case() {
        let event = TrackerEvent::Custom(CustomEventData {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            event_name: "signup".into(),
            properties: Some(HashMap::from([
                ("plan".into(), json!("pro")),
            ])),
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "custom");
        assert_eq!(json["eventName"], "signup");  // camelCase
        assert!(json.get("event_name").is_none()); // not snake_case
    }

    #[test]
    fn test_identify_event_camel_case() {
        let event = TrackerEvent::Identify(IdentifyEventData {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            email: Some("user@example.com".into()),
            user_id: Some("usr_123".into()),
            traits: None,
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "identify");
        assert_eq!(json["userId"], "usr_123");  // camelCase
    }

    #[test]
    fn test_stage_event_serialization() {
        let event = TrackerEvent::Stage(StageEventData {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            stage: JourneyStage::Activated,
            properties: None,
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "stage");
        assert_eq!(json["stage"], "activated");
    }

    #[test]
    fn test_billing_event_camel_case() {
        let event = TrackerEvent::Billing(BillingEventData {
            timestamp: 1706400000000,
            url: "server://acme.com".into(),
            path: "/".into(),
            status: BillingStatus::Paid,
            customer_id: Some("cust_123".into()),
            stripe_customer_id: Some("cus_xxx".into()),
            domain: Some("acme.com".into()),
            properties: None,
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "billing");
        assert_eq!(json["status"], "paid");
        assert_eq!(json["customerId"], "cust_123");  // camelCase
        assert_eq!(json["stripeCustomerId"], "cus_xxx");  // camelCase
    }

    #[test]
    fn test_optional_fields_omitted() {
        let event = TrackerEvent::Custom(CustomEventData {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            event_name: "test".into(),
            properties: None,
        });

        let json_str = serde_json::to_string(&event).unwrap();

        assert!(!json_str.contains("properties"));
    }

    #[test]
    fn test_ingest_payload_structure() {
        let payload = IngestPayload {
            source: SourceType::Server,
            events: vec![],
        };

        let json = serde_json::to_value(&payload).unwrap();

        assert_eq!(json["source"], "server");
        assert!(json["events"].is_array());
        assert!(json.get("visitorId").is_none());  // server events don't have visitorId
    }
}
```

**Step 2: Update lib.rs to include types module**

Add to `crates/outlit/src/lib.rs` after `mod error;`:

```rust
mod types;

pub use types::{
    BillingStatus, IngestPayload, IngestResponse, JourneyStage, SourceType, TrackerEvent,
};
```

**Step 3: Run tests**

Run: `cargo test`

Expected: All serialization tests PASS

**Step 4: Commit**

```bash
git add crates/outlit/src/types.rs crates/outlit/src/lib.rs
git commit -m "feat(rust): add event types with camelCase serialization"
```

---

### Task 4: Implement Config and Builder

**Files:**
- Create: `crates/outlit/src/config.rs`
- Modify: `crates/outlit/src/lib.rs`

**Step 1: Write config tests**

Create `crates/outlit/src/config.rs`:

```rust
//! Client configuration.

use std::time::Duration;

/// Default API host.
pub const DEFAULT_API_HOST: &str = "https://app.outlit.ai";

/// Default flush interval.
pub const DEFAULT_FLUSH_INTERVAL: Duration = Duration::from_secs(10);

/// Default max batch size.
pub const DEFAULT_MAX_BATCH_SIZE: usize = 100;

/// Default request timeout.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(10);

/// Outlit client configuration.
#[derive(Debug, Clone)]
pub struct Config {
    pub(crate) public_key: String,
    pub(crate) api_host: String,
    pub(crate) flush_interval: Duration,
    pub(crate) max_batch_size: usize,
    pub(crate) timeout: Duration,
}

impl Config {
    /// Get the public key.
    pub fn public_key(&self) -> &str {
        &self.public_key
    }

    /// Get the API host.
    pub fn api_host(&self) -> &str {
        &self.api_host
    }

    /// Get the flush interval.
    pub fn flush_interval(&self) -> Duration {
        self.flush_interval
    }

    /// Get the max batch size.
    pub fn max_batch_size(&self) -> usize {
        self.max_batch_size
    }

    /// Get the request timeout.
    pub fn timeout(&self) -> Duration {
        self.timeout
    }
}

/// Builder for Outlit client.
#[derive(Debug)]
pub struct OutlitBuilder {
    public_key: String,
    api_host: Option<String>,
    flush_interval: Option<Duration>,
    max_batch_size: Option<usize>,
    timeout: Option<Duration>,
}

impl OutlitBuilder {
    /// Create a new builder with the given public key.
    pub fn new(public_key: impl Into<String>) -> Self {
        Self {
            public_key: public_key.into(),
            api_host: None,
            flush_interval: None,
            max_batch_size: None,
            timeout: None,
        }
    }

    /// Set the API host.
    pub fn api_host(mut self, host: impl Into<String>) -> Self {
        self.api_host = Some(host.into());
        self
    }

    /// Set the flush interval.
    pub fn flush_interval(mut self, interval: Duration) -> Self {
        self.flush_interval = Some(interval);
        self
    }

    /// Set the max batch size.
    pub fn max_batch_size(mut self, size: usize) -> Self {
        self.max_batch_size = Some(size);
        self
    }

    /// Set the request timeout.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    /// Build the configuration.
    pub(crate) fn build_config(self) -> Result<Config, crate::Error> {
        if self.public_key.is_empty() {
            return Err(crate::Error::Config("public_key cannot be empty".into()));
        }

        Ok(Config {
            public_key: self.public_key,
            api_host: self.api_host.unwrap_or_else(|| DEFAULT_API_HOST.into()),
            flush_interval: self.flush_interval.unwrap_or(DEFAULT_FLUSH_INTERVAL),
            max_batch_size: self.max_batch_size.unwrap_or(DEFAULT_MAX_BATCH_SIZE),
            timeout: self.timeout.unwrap_or(DEFAULT_TIMEOUT),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_defaults() {
        let config = OutlitBuilder::new("pk_test").build_config().unwrap();

        assert_eq!(config.public_key(), "pk_test");
        assert_eq!(config.api_host(), DEFAULT_API_HOST);
        assert_eq!(config.flush_interval(), DEFAULT_FLUSH_INTERVAL);
        assert_eq!(config.max_batch_size(), DEFAULT_MAX_BATCH_SIZE);
        assert_eq!(config.timeout(), DEFAULT_TIMEOUT);
    }

    #[test]
    fn test_builder_custom_values() {
        let config = OutlitBuilder::new("pk_test")
            .api_host("https://custom.example.com")
            .flush_interval(Duration::from_secs(5))
            .max_batch_size(50)
            .timeout(Duration::from_secs(30))
            .build_config()
            .unwrap();

        assert_eq!(config.api_host(), "https://custom.example.com");
        assert_eq!(config.flush_interval(), Duration::from_secs(5));
        assert_eq!(config.max_batch_size(), 50);
        assert_eq!(config.timeout(), Duration::from_secs(30));
    }

    #[test]
    fn test_builder_empty_public_key_fails() {
        let result = OutlitBuilder::new("").build_config();
        assert!(result.is_err());
    }

    #[test]
    fn test_builder_accepts_string_and_str() {
        // &str
        let _ = OutlitBuilder::new("pk_test");
        // String
        let _ = OutlitBuilder::new(String::from("pk_test"));
        // Same for api_host
        let _ = OutlitBuilder::new("pk_test").api_host("https://example.com");
        let _ = OutlitBuilder::new("pk_test").api_host(String::from("https://example.com"));
    }
}
```

**Step 2: Update lib.rs**

Replace the placeholder `OutlitBuilder` in `lib.rs`:

```rust
mod config;
mod error;
mod types;

pub use config::{Config, OutlitBuilder};
pub use error::Error;
pub use types::{
    BillingStatus, IngestPayload, IngestResponse, JourneyStage, SourceType, TrackerEvent,
};

use std::time::Duration;

/// Outlit analytics client.
pub struct Outlit {
    config: Config,
}

impl Outlit {
    /// Create a new builder with the given public key.
    pub fn builder(public_key: impl Into<String>) -> OutlitBuilder {
        OutlitBuilder::new(public_key)
    }

    /// Get the client configuration.
    pub fn config(&self) -> &Config {
        &self.config
    }
}

impl OutlitBuilder {
    /// Build the Outlit client.
    pub fn build(self) -> Result<Outlit, Error> {
        let config = self.build_config()?;
        Ok(Outlit { config })
    }
}

// Re-export identity helpers
/// Create an email identity.
pub fn email(e: impl Into<String>) -> Email {
    Email(e.into())
}

/// Create a user ID identity.
pub fn user_id(id: impl Into<String>) -> UserId {
    UserId(id.into())
}

/// Email identity wrapper.
#[derive(Debug, Clone)]
pub struct Email(pub(crate) String);

impl Email {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<Email> for String {
    fn from(e: Email) -> String {
        e.0
    }
}

/// User ID identity wrapper.
#[derive(Debug, Clone)]
pub struct UserId(pub(crate) String);

impl UserId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<UserId> for String {
    fn from(id: UserId) -> String {
        id.0
    }
}
```

**Step 3: Run tests**

Run: `cargo test`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add crates/outlit/src/config.rs crates/outlit/src/lib.rs
git commit -m "feat(rust): add client configuration with builder pattern"
```

---

### Task 5: Implement Event Queue

**Files:**
- Create: `crates/outlit/src/queue.rs`
- Modify: `crates/outlit/src/lib.rs`

**Step 1: Write queue tests and implementation**

Create `crates/outlit/src/queue.rs`:

```rust
//! Event queue with batching.

use crate::types::TrackerEvent;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Event queue that batches events for sending.
#[derive(Debug)]
pub struct EventQueue {
    events: Arc<Mutex<Vec<TrackerEvent>>>,
    max_size: usize,
}

impl EventQueue {
    /// Create a new event queue.
    pub fn new(max_size: usize) -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            max_size,
        }
    }

    /// Add an event to the queue.
    pub async fn enqueue(&self, event: TrackerEvent) {
        let mut events = self.events.lock().await;
        events.push(event);
    }

    /// Check if the queue should be flushed.
    pub async fn should_flush(&self) -> bool {
        let events = self.events.lock().await;
        events.len() >= self.max_size
    }

    /// Get the number of events in the queue.
    pub async fn len(&self) -> usize {
        let events = self.events.lock().await;
        events.len()
    }

    /// Check if the queue is empty.
    pub async fn is_empty(&self) -> bool {
        self.len().await == 0
    }

    /// Drain all events from the queue.
    pub async fn drain(&self) -> Vec<TrackerEvent> {
        let mut events = self.events.lock().await;
        std::mem::take(&mut *events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CustomEventData, TrackerEvent};
    use serde_json::json;
    use std::collections::HashMap;

    fn make_test_event(id: i32) -> TrackerEvent {
        TrackerEvent::Custom(CustomEventData {
            timestamp: 1706400000000,
            url: format!("server://test{}", id),
            path: "/".into(),
            event_name: format!("event_{}", id),
            properties: Some(HashMap::from([("id".into(), json!(id))])),
        })
    }

    #[tokio::test]
    async fn test_enqueue_and_len() {
        let queue = EventQueue::new(10);

        assert_eq!(queue.len().await, 0);
        assert!(queue.is_empty().await);

        queue.enqueue(make_test_event(1)).await;
        assert_eq!(queue.len().await, 1);
        assert!(!queue.is_empty().await);

        queue.enqueue(make_test_event(2)).await;
        assert_eq!(queue.len().await, 2);
    }

    #[tokio::test]
    async fn test_should_flush_at_max_size() {
        let queue = EventQueue::new(3);

        queue.enqueue(make_test_event(1)).await;
        queue.enqueue(make_test_event(2)).await;
        assert!(!queue.should_flush().await);

        queue.enqueue(make_test_event(3)).await;
        assert!(queue.should_flush().await);
    }

    #[tokio::test]
    async fn test_drain() {
        let queue = EventQueue::new(10);

        queue.enqueue(make_test_event(1)).await;
        queue.enqueue(make_test_event(2)).await;
        queue.enqueue(make_test_event(3)).await;

        let events = queue.drain().await;
        assert_eq!(events.len(), 3);
        assert!(queue.is_empty().await);
    }

    #[tokio::test]
    async fn test_concurrent_enqueue() {
        let queue = Arc::new(EventQueue::new(1000));
        let mut handles = vec![];

        for i in 0..100 {
            let q = queue.clone();
            handles.push(tokio::spawn(async move {
                q.enqueue(make_test_event(i)).await;
            }));
        }

        for handle in handles {
            handle.await.unwrap();
        }

        assert_eq!(queue.len().await, 100);
    }
}
```

**Step 2: Add to lib.rs**

Add after other mod declarations:

```rust
mod queue;

pub(crate) use queue::EventQueue;
```

**Step 3: Run tests**

Run: `cargo test`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add crates/outlit/src/queue.rs crates/outlit/src/lib.rs
git commit -m "feat(rust): add event queue with batching"
```

---

### Task 6: Implement HTTP Transport

**Files:**
- Create: `crates/outlit/src/transport.rs`
- Modify: `crates/outlit/src/lib.rs`

**Step 1: Write transport implementation**

Create `crates/outlit/src/transport.rs`:

```rust
//! HTTP transport for sending events.

use crate::config::Config;
use crate::types::{IngestPayload, IngestResponse};
use crate::Error;
use std::time::Duration;
use tracing::{debug, warn};

/// HTTP transport for sending events to the Outlit API.
#[derive(Debug)]
pub struct HttpTransport {
    client: reqwest::Client,
    endpoint: String,
}

impl HttpTransport {
    /// Create a new HTTP transport.
    pub fn new(config: &Config) -> Result<Self, Error> {
        let client = reqwest::Client::builder()
            .timeout(config.timeout())
            .build()?;

        let endpoint = format!(
            "{}/api/i/v1/{}/events",
            config.api_host(),
            config.public_key()
        );

        Ok(Self { client, endpoint })
    }

    /// Send a payload to the ingest API.
    pub async fn send(&self, payload: &IngestPayload) -> Result<IngestResponse, Error> {
        debug!(
            endpoint = %self.endpoint,
            event_count = payload.events.len(),
            "sending events"
        );

        let response = self
            .client
            .post(&self.endpoint)
            .header("Content-Type", "application/json")
            .json(payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
            warn!(status = %status, body = %body, "API request failed");
            return Err(Error::Config(format!("HTTP {}: {}", status, body)));
        }

        let result = response.json::<IngestResponse>().await?;

        if let Some(errors) = &result.errors {
            for error in errors {
                warn!(
                    index = error.index,
                    message = %error.message,
                    "event processing error"
                );
            }
        }

        debug!(processed = result.processed, "events sent successfully");

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::OutlitBuilder;

    #[test]
    fn test_endpoint_construction() {
        let config = OutlitBuilder::new("pk_test_123")
            .api_host("https://example.com")
            .build_config()
            .unwrap();

        let transport = HttpTransport::new(&config).unwrap();

        assert_eq!(
            transport.endpoint,
            "https://example.com/api/i/v1/pk_test_123/events"
        );
    }
}
```

**Step 2: Add to lib.rs**

Add after other mod declarations:

```rust
mod transport;

pub(crate) use transport::HttpTransport;
```

**Step 3: Run tests**

Run: `cargo test`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add crates/outlit/src/transport.rs crates/outlit/src/lib.rs
git commit -m "feat(rust): add HTTP transport"
```

---

### Task 7: Implement Event Builders

**Files:**
- Create: `crates/outlit/src/builders.rs`
- Modify: `crates/outlit/src/lib.rs`

**Step 1: Write builder implementations**

Create `crates/outlit/src/builders.rs`:

```rust
//! Event builders for fluent API.

use crate::types::{
    BillingEventData, BillingStatus, CustomEventData, IdentifyEventData, JourneyStage,
    StageEventData, TrackerEvent,
};
use crate::{Email, Error, UserId};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Get current timestamp in milliseconds.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

/// Build a server URL from identity.
fn server_url(email: Option<&str>, user_id: Option<&str>) -> String {
    let id = email.or(user_id).unwrap_or("unknown");
    format!("server://{}", id)
}

/// Identity for events.
#[derive(Debug, Clone)]
pub enum Identity {
    Email(Email),
    UserId(UserId),
}

impl Identity {
    fn email(&self) -> Option<&str> {
        match self {
            Identity::Email(e) => Some(e.as_str()),
            Identity::UserId(_) => None,
        }
    }

    fn user_id(&self) -> Option<&str> {
        match self {
            Identity::UserId(id) => Some(id.as_str()),
            Identity::Email(_) => None,
        }
    }
}

impl From<Email> for Identity {
    fn from(e: Email) -> Self {
        Identity::Email(e)
    }
}

impl From<UserId> for Identity {
    fn from(id: UserId) -> Self {
        Identity::UserId(id)
    }
}

// ============================================
// TRACK BUILDER
// ============================================

/// Builder for track events.
#[derive(Debug)]
pub struct TrackBuilder {
    event_name: String,
    identity: Identity,
    additional_email: Option<String>,
    additional_user_id: Option<String>,
    properties: HashMap<String, Value>,
    timestamp: Option<i64>,
}

impl TrackBuilder {
    pub(crate) fn new(event_name: impl Into<String>, identity: impl Into<Identity>) -> Self {
        Self {
            event_name: event_name.into(),
            identity: identity.into(),
            additional_email: None,
            additional_user_id: None,
            properties: HashMap::new(),
            timestamp: None,
        }
    }

    /// Add email (if identity was user_id).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.additional_email = Some(email.into());
        self
    }

    /// Add user_id (if identity was email).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.additional_user_id = Some(user_id.into());
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.properties.insert(key.into(), value.into());
        self
    }

    /// Set custom timestamp (milliseconds since epoch).
    pub fn timestamp(mut self, ts: i64) -> Self {
        self.timestamp = Some(ts);
        self
    }

    /// Build the event.
    pub(crate) fn build(self) -> TrackerEvent {
        let email = self.identity.email().map(String::from).or(self.additional_email);
        let user_id = self.identity.user_id().map(String::from).or(self.additional_user_id);

        let mut properties = self.properties;
        // Include identity in properties for server-side resolution
        properties.insert("__email".into(), json!(email));
        properties.insert("__userId".into(), json!(user_id));

        TrackerEvent::Custom(CustomEventData {
            timestamp: self.timestamp.unwrap_or_else(now_ms),
            url: server_url(email.as_deref(), user_id.as_deref()),
            path: "/".into(),
            event_name: self.event_name,
            properties: Some(properties),
        })
    }
}

// ============================================
// IDENTIFY BUILDER
// ============================================

/// Builder for identify events.
#[derive(Debug)]
pub struct IdentifyBuilder {
    identity: Identity,
    additional_email: Option<String>,
    additional_user_id: Option<String>,
    traits: HashMap<String, Value>,
}

impl IdentifyBuilder {
    pub(crate) fn new(identity: impl Into<Identity>) -> Self {
        Self {
            identity: identity.into(),
            additional_email: None,
            additional_user_id: None,
            traits: HashMap::new(),
        }
    }

    /// Add email (if identity was user_id).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.additional_email = Some(email.into());
        self
    }

    /// Add user_id (if identity was email).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.additional_user_id = Some(user_id.into());
        self
    }

    /// Add a trait (using trait_ because trait is reserved).
    pub fn trait_(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.traits.insert(key.into(), value.into());
        self
    }

    /// Build the event.
    pub(crate) fn build(self) -> TrackerEvent {
        let email = self.identity.email().map(String::from).or(self.additional_email);
        let user_id = self.identity.user_id().map(String::from).or(self.additional_user_id);

        TrackerEvent::Identify(IdentifyEventData {
            timestamp: now_ms(),
            url: server_url(email.as_deref(), user_id.as_deref()),
            path: "/".into(),
            email,
            user_id,
            traits: if self.traits.is_empty() {
                None
            } else {
                Some(self.traits)
            },
        })
    }
}

// ============================================
// STAGE BUILDER
// ============================================

/// Builder for stage events.
#[derive(Debug)]
pub struct StageBuilder {
    stage: JourneyStage,
    identity: Identity,
    additional_email: Option<String>,
    additional_user_id: Option<String>,
    properties: HashMap<String, Value>,
}

impl StageBuilder {
    pub(crate) fn new(stage: JourneyStage, identity: impl Into<Identity>) -> Self {
        Self {
            stage,
            identity: identity.into(),
            additional_email: None,
            additional_user_id: None,
            properties: HashMap::new(),
        }
    }

    /// Add email (if identity was user_id).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.additional_email = Some(email.into());
        self
    }

    /// Add user_id (if identity was email).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.additional_user_id = Some(user_id.into());
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.properties.insert(key.into(), value.into());
        self
    }

    /// Build the event.
    pub(crate) fn build(self) -> TrackerEvent {
        let email = self.identity.email().map(String::from).or(self.additional_email);
        let user_id = self.identity.user_id().map(String::from).or(self.additional_user_id);

        let mut properties = self.properties;
        // Include identity in properties for server-side resolution
        properties.insert("__email".into(), json!(email));
        properties.insert("__userId".into(), json!(user_id));

        TrackerEvent::Stage(StageEventData {
            timestamp: now_ms(),
            url: server_url(email.as_deref(), user_id.as_deref()),
            path: "/".into(),
            stage: self.stage,
            properties: if properties.is_empty() {
                None
            } else {
                Some(properties)
            },
        })
    }
}

// ============================================
// BILLING BUILDER
// ============================================

/// Builder for billing events.
#[derive(Debug)]
pub struct BillingBuilder {
    status: BillingStatus,
    domain: String,
    customer_id: Option<String>,
    stripe_customer_id: Option<String>,
    properties: HashMap<String, Value>,
}

impl BillingBuilder {
    pub(crate) fn new(status: BillingStatus, domain: impl Into<String>) -> Self {
        Self {
            status,
            domain: domain.into(),
            customer_id: None,
            stripe_customer_id: None,
            properties: HashMap::new(),
        }
    }

    /// Set customer ID.
    pub fn customer_id(mut self, id: impl Into<String>) -> Self {
        self.customer_id = Some(id.into());
        self
    }

    /// Set Stripe customer ID.
    pub fn stripe_customer_id(mut self, id: impl Into<String>) -> Self {
        self.stripe_customer_id = Some(id.into());
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.properties.insert(key.into(), value.into());
        self
    }

    /// Build the event.
    pub(crate) fn build(self) -> TrackerEvent {
        TrackerEvent::Billing(BillingEventData {
            timestamp: now_ms(),
            url: format!("server://{}", self.domain),
            path: "/".into(),
            status: self.status,
            customer_id: self.customer_id,
            stripe_customer_id: self.stripe_customer_id,
            domain: Some(self.domain),
            properties: if self.properties.is_empty() {
                None
            } else {
                Some(self.properties)
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{email, user_id};

    #[test]
    fn test_track_builder_with_email() {
        let event = TrackBuilder::new("signup", email("user@example.com"))
            .property("plan", "pro")
            .build();

        if let TrackerEvent::Custom(data) = event {
            assert_eq!(data.event_name, "signup");
            assert!(data.url.contains("user@example.com"));
            let props = data.properties.unwrap();
            assert_eq!(props.get("plan").unwrap(), "pro");
            assert_eq!(props.get("__email").unwrap(), "user@example.com");
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_track_builder_with_user_id() {
        let event = TrackBuilder::new("signup", user_id("usr_123"))
            .email("user@example.com")  // add email too
            .build();

        if let TrackerEvent::Custom(data) = event {
            let props = data.properties.unwrap();
            assert_eq!(props.get("__userId").unwrap(), "usr_123");
            assert_eq!(props.get("__email").unwrap(), "user@example.com");
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_identify_builder() {
        let event = IdentifyBuilder::new(email("user@example.com"))
            .user_id("usr_123")
            .trait_("name", "John")
            .trait_("plan", "pro")
            .build();

        if let TrackerEvent::Identify(data) = event {
            assert_eq!(data.email, Some("user@example.com".into()));
            assert_eq!(data.user_id, Some("usr_123".into()));
            let traits = data.traits.unwrap();
            assert_eq!(traits.get("name").unwrap(), "John");
        } else {
            panic!("Expected identify event");
        }
    }

    #[test]
    fn test_stage_builder() {
        let event = StageBuilder::new(JourneyStage::Activated, email("user@example.com"))
            .property("source", "onboarding")
            .build();

        if let TrackerEvent::Stage(data) = event {
            assert!(matches!(data.stage, JourneyStage::Activated));
        } else {
            panic!("Expected stage event");
        }
    }

    #[test]
    fn test_billing_builder() {
        let event = BillingBuilder::new(BillingStatus::Paid, "acme.com")
            .customer_id("cust_123")
            .stripe_customer_id("cus_xxx")
            .property("plan", "enterprise")
            .build();

        if let TrackerEvent::Billing(data) = event {
            assert!(matches!(data.status, BillingStatus::Paid));
            assert_eq!(data.domain, Some("acme.com".into()));
            assert_eq!(data.customer_id, Some("cust_123".into()));
        } else {
            panic!("Expected billing event");
        }
    }
}
```

**Step 2: Add to lib.rs**

Add after other mod declarations:

```rust
mod builders;

pub use builders::{BillingBuilder, IdentifyBuilder, StageBuilder, TrackBuilder};
```

**Step 3: Run tests**

Run: `cargo test`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add crates/outlit/src/builders.rs crates/outlit/src/lib.rs
git commit -m "feat(rust): add event builders with fluent API"
```

---

### Task 8: Implement Full Client with Async Methods

**Files:**
- Create: `crates/outlit/src/client.rs`
- Modify: `crates/outlit/src/lib.rs`

**Step 1: Write client implementation**

Create `crates/outlit/src/client.rs`:

```rust
//! Outlit client implementation.

use crate::builders::{BillingBuilder, IdentifyBuilder, StageBuilder, TrackBuilder};
use crate::config::{Config, OutlitBuilder};
use crate::queue::EventQueue;
use crate::transport::HttpTransport;
use crate::types::{BillingStatus, IngestPayload, JourneyStage, SourceType};
use crate::{Email, Error, UserId};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};
use tracing::{debug, error, info, instrument};

/// Outlit analytics client.
///
/// Unlike the browser SDK, this requires identity (email or userId) for all calls.
/// Anonymous tracking is not supported server-side.
///
/// # Example
///
/// ```rust,no_run
/// use outlit::{Outlit, email};
/// use std::time::Duration;
///
/// #[tokio::main]
/// async fn main() -> Result<(), outlit::Error> {
///     let client = Outlit::builder("pk_xxx")
///         .flush_interval(Duration::from_secs(5))
///         .build()?;
///
///     client.track("signup", email("user@example.com"))
///         .property("plan", "pro")
///         .send()
///         .await?;
///
///     client.shutdown().await?;
///     Ok(())
/// }
/// ```
pub struct Outlit {
    config: Config,
    queue: Arc<EventQueue>,
    transport: Arc<HttpTransport>,
    is_shutdown: AtomicBool,
    flush_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl Outlit {
    /// Create a new builder with the given public key.
    pub fn builder(public_key: impl Into<String>) -> OutlitBuilder {
        OutlitBuilder::new(public_key)
    }

    /// Create a new client from config.
    pub(crate) fn from_config(config: Config) -> Result<Self, Error> {
        let queue = Arc::new(EventQueue::new(config.max_batch_size()));
        let transport = Arc::new(HttpTransport::new(&config)?);

        let client = Self {
            config,
            queue,
            transport,
            is_shutdown: AtomicBool::new(false),
            flush_handle: Mutex::new(None),
        };

        client.start_flush_timer();

        Ok(client)
    }

    /// Get the client configuration.
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Get the number of pending events.
    pub async fn pending_event_count(&self) -> usize {
        self.queue.len().await
    }

    // ============================================
    // TRACK
    // ============================================

    /// Track a custom event.
    ///
    /// Requires identity (email or user_id) to be provided.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use outlit::{Outlit, email};
    /// # async fn example(client: &Outlit) -> Result<(), outlit::Error> {
    /// client.track("feature_used", email("user@example.com"))
    ///     .property("feature", "export")
    ///     .send()
    ///     .await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn track(&self, event_name: impl Into<String>, identity: impl Into<Email>) -> SendableTrack {
        SendableTrack {
            builder: TrackBuilder::new(event_name, identity.into()),
            client: self,
        }
    }

    /// Track a custom event with user_id.
    pub fn track_by_user_id(
        &self,
        event_name: impl Into<String>,
        identity: impl Into<UserId>,
    ) -> SendableTrack {
        SendableTrack {
            builder: TrackBuilder::new(event_name, identity.into()),
            client: self,
        }
    }

    // ============================================
    // IDENTIFY
    // ============================================

    /// Identify or update a user.
    ///
    /// Unlike the browser SDK which links anonymous visitors to users,
    /// the Rust SDK's `identify()` is for updating user data when your
    /// app learns new information about them (login, settings change, etc.)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use outlit::{Outlit, email};
    /// # async fn example(client: &Outlit) -> Result<(), outlit::Error> {
    /// client.identify(email("user@example.com"))
    ///     .user_id("usr_123")
    ///     .trait_("name", "John Doe")
    ///     .send()
    ///     .await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn identify(&self, identity: impl Into<Email>) -> SendableIdentify {
        SendableIdentify {
            builder: IdentifyBuilder::new(identity.into()),
            client: self,
        }
    }

    /// Identify by user_id.
    pub fn identify_by_user_id(&self, identity: impl Into<UserId>) -> SendableIdentify {
        SendableIdentify {
            builder: IdentifyBuilder::new(identity.into()),
            client: self,
        }
    }

    // ============================================
    // USER STAGES
    // ============================================

    /// User journey stage methods.
    pub fn user(&self) -> UserMethods {
        UserMethods { client: self }
    }

    // ============================================
    // CUSTOMER BILLING
    // ============================================

    /// Customer billing methods.
    pub fn customer(&self) -> CustomerMethods {
        CustomerMethods { client: self }
    }

    // ============================================
    // LIFECYCLE
    // ============================================

    /// Flush all pending events immediately.
    ///
    /// Important: Call this before your application exits!
    #[instrument(skip(self))]
    pub async fn flush(&self) -> Result<(), Error> {
        if self.queue.is_empty().await {
            return Ok(());
        }

        let events = self.queue.drain().await;
        if events.is_empty() {
            return Ok(());
        }

        info!(event_count = events.len(), "flushing events");

        let payload = IngestPayload {
            source: SourceType::Server,
            events,
        };

        self.transport.send(&payload).await?;

        Ok(())
    }

    /// Shutdown the client gracefully.
    ///
    /// Flushes remaining events and stops the background flush timer.
    #[instrument(skip(self))]
    pub async fn shutdown(&self) -> Result<(), Error> {
        if self.is_shutdown.swap(true, Ordering::SeqCst) {
            return Ok(()); // Already shutdown
        }

        info!("shutting down client");

        // Stop flush timer
        if let Some(handle) = self.flush_handle.lock().await.take() {
            handle.abort();
        }

        // Final flush
        self.flush().await?;

        Ok(())
    }

    // ============================================
    // INTERNAL
    // ============================================

    fn ensure_not_shutdown(&self) -> Result<(), Error> {
        if self.is_shutdown.load(Ordering::SeqCst) {
            return Err(Error::Shutdown);
        }
        Ok(())
    }

    fn start_flush_timer(&self) {
        let queue = self.queue.clone();
        let transport = self.transport.clone();
        let flush_interval = self.config.flush_interval();
        let is_shutdown = &self.is_shutdown as *const AtomicBool;

        // SAFETY: We ensure the client lives longer than the task
        let handle = tokio::spawn(async move {
            let mut timer = interval(flush_interval);

            loop {
                timer.tick().await;

                // Check if shutdown
                // SAFETY: Client must outlive this task
                if unsafe { (*is_shutdown).load(Ordering::SeqCst) } {
                    break;
                }

                if queue.is_empty().await {
                    continue;
                }

                let events = queue.drain().await;
                if events.is_empty() {
                    continue;
                }

                debug!(event_count = events.len(), "periodic flush");

                let payload = IngestPayload {
                    source: SourceType::Server,
                    events,
                };

                if let Err(e) = transport.send(&payload).await {
                    error!(error = %e, "flush failed");
                }
            }
        });

        // Store handle but don't block on it
        let flush_handle = self.flush_handle.try_lock();
        if let Ok(mut guard) = flush_handle {
            *guard = Some(handle);
        }
    }

    async fn enqueue_and_maybe_flush(&self, builder: impl BuildEvent) -> Result<(), Error> {
        self.ensure_not_shutdown()?;

        let event = builder.build();
        self.queue.enqueue(event).await;

        if self.queue.should_flush().await {
            self.flush().await?;
        }

        Ok(())
    }
}

// ============================================
// SENDABLE WRAPPERS
// ============================================

trait BuildEvent {
    fn build(self) -> crate::types::TrackerEvent;
}

impl BuildEvent for TrackBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

impl BuildEvent for IdentifyBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

impl BuildEvent for StageBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

impl BuildEvent for BillingBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

/// Sendable track event builder.
pub struct SendableTrack<'a> {
    builder: TrackBuilder,
    client: &'a Outlit,
}

impl<'a> SendableTrack<'a> {
    /// Add email (if identity was user_id).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.builder = self.builder.email(email);
        self
    }

    /// Add user_id (if identity was email).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.builder = self.builder.user_id(user_id);
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.property(key, value);
        self
    }

    /// Set custom timestamp.
    pub fn timestamp(mut self, ts: i64) -> Self {
        self.builder = self.builder.timestamp(ts);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

/// Sendable identify event builder.
pub struct SendableIdentify<'a> {
    builder: IdentifyBuilder,
    client: &'a Outlit,
}

impl<'a> SendableIdentify<'a> {
    /// Add email.
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.builder = self.builder.email(email);
        self
    }

    /// Add user_id.
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.builder = self.builder.user_id(user_id);
        self
    }

    /// Add a trait.
    pub fn trait_(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.trait_(key, value);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

/// Sendable stage event builder.
pub struct SendableStage<'a> {
    builder: StageBuilder,
    client: &'a Outlit,
}

impl<'a> SendableStage<'a> {
    /// Add email.
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.builder = self.builder.email(email);
        self
    }

    /// Add user_id.
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.builder = self.builder.user_id(user_id);
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.property(key, value);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

/// Sendable billing event builder.
pub struct SendableBilling<'a> {
    builder: BillingBuilder,
    client: &'a Outlit,
}

impl<'a> SendableBilling<'a> {
    /// Set customer ID.
    pub fn customer_id(mut self, id: impl Into<String>) -> Self {
        self.builder = self.builder.customer_id(id);
        self
    }

    /// Set Stripe customer ID.
    pub fn stripe_customer_id(mut self, id: impl Into<String>) -> Self {
        self.builder = self.builder.stripe_customer_id(id);
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.property(key, value);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

// ============================================
// NAMESPACE METHODS
// ============================================

/// User journey stage methods.
pub struct UserMethods<'a> {
    client: &'a Outlit,
}

impl<'a> UserMethods<'a> {
    /// Mark user as activated.
    pub fn activate(&self, identity: impl Into<Email>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Activated, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as activated by user_id.
    pub fn activate_by_user_id(&self, identity: impl Into<UserId>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Activated, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as engaged.
    pub fn engaged(&self, identity: impl Into<Email>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Engaged, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as engaged by user_id.
    pub fn engaged_by_user_id(&self, identity: impl Into<UserId>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Engaged, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as inactive.
    pub fn inactive(&self, identity: impl Into<Email>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Inactive, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as inactive by user_id.
    pub fn inactive_by_user_id(&self, identity: impl Into<UserId>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Inactive, identity.into()),
            client: self.client,
        }
    }
}

/// Customer billing methods.
pub struct CustomerMethods<'a> {
    client: &'a Outlit,
}

impl<'a> CustomerMethods<'a> {
    /// Mark customer as trialing.
    pub fn trialing(&self, domain: impl Into<String>) -> SendableBilling<'a> {
        SendableBilling {
            builder: BillingBuilder::new(BillingStatus::Trialing, domain),
            client: self.client,
        }
    }

    /// Mark customer as paid.
    pub fn paid(&self, domain: impl Into<String>) -> SendableBilling<'a> {
        SendableBilling {
            builder: BillingBuilder::new(BillingStatus::Paid, domain),
            client: self.client,
        }
    }

    /// Mark customer as churned.
    pub fn churned(&self, domain: impl Into<String>) -> SendableBilling<'a> {
        SendableBilling {
            builder: BillingBuilder::new(BillingStatus::Churned, domain),
            client: self.client,
        }
    }
}
```

**Step 2: Update lib.rs to use client module**

Replace `lib.rs` contents:

```rust
//! Outlit analytics SDK for Rust.
//!
//! # Example
//!
//! ```rust,no_run
//! use outlit::{Outlit, email};
//! use std::time::Duration;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), outlit::Error> {
//!     let client = Outlit::builder("pk_xxx")
//!         .flush_interval(Duration::from_secs(5))
//!         .build()?;
//!
//!     client.track("signup", email("user@example.com"))
//!         .property("plan", "pro")
//!         .send()
//!         .await?;
//!
//!     client.shutdown().await?;
//!     Ok(())
//! }
//! ```

mod builders;
mod client;
mod config;
mod error;
mod queue;
mod transport;
mod types;

pub use client::{
    CustomerMethods, Outlit, SendableBilling, SendableIdentify, SendableStage, SendableTrack,
    UserMethods,
};
pub use config::{Config, OutlitBuilder};
pub use error::Error;
pub use types::{
    BillingStatus, IngestPayload, IngestResponse, JourneyStage, SourceType, TrackerEvent,
};

// Identity helpers

/// Create an email identity.
pub fn email(e: impl Into<String>) -> Email {
    Email(e.into())
}

/// Create a user ID identity.
pub fn user_id(id: impl Into<String>) -> UserId {
    UserId(id.into())
}

/// Email identity wrapper.
#[derive(Debug, Clone)]
pub struct Email(pub(crate) String);

impl Email {
    /// Get the email as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<Email> for String {
    fn from(e: Email) -> String {
        e.0
    }
}

impl From<Email> for builders::Identity {
    fn from(e: Email) -> builders::Identity {
        builders::Identity::Email(e)
    }
}

/// User ID identity wrapper.
#[derive(Debug, Clone)]
pub struct UserId(pub(crate) String);

impl UserId {
    /// Get the user ID as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<UserId> for String {
    fn from(id: UserId) -> String {
        id.0
    }
}

impl From<UserId> for builders::Identity {
    fn from(id: UserId) -> builders::Identity {
        builders::Identity::UserId(id)
    }
}

// Update OutlitBuilder to create client
impl OutlitBuilder {
    /// Build the Outlit client.
    pub fn build(self) -> Result<Outlit, Error> {
        let config = self.build_config()?;
        Outlit::from_config(config)
    }
}
```

**Step 3: Run tests**

Run: `cargo test`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add crates/outlit/src/client.rs crates/outlit/src/lib.rs
git commit -m "feat(rust): implement full Outlit client with async methods"
```

---

### Task 9: Add Integration Tests

**Files:**
- Create: `crates/outlit/tests/integration.rs`

**Step 1: Write integration tests**

Create `crates/outlit/tests/integration.rs`:

```rust
//! Integration tests for the Outlit SDK.

use outlit::{email, user_id, Outlit};
use serde_json::json;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use wiremock::matchers::{body_json_schema, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_track_sends_correct_payload() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/i/v1/pk_test/events"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100)) // Don't auto-flush
        .build()
        .unwrap();

    client
        .track("test_event", email("user@test.com"))
        .property("plan", "pro")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_identify_sends_correct_payload() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/i/v1/pk_test/events"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .identify(email("user@test.com"))
        .user_id("usr_123")
        .trait_("name", "John")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_stage_events() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(3)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .max_batch_size(1) // Flush after each event
        .build()
        .unwrap();

    client
        .user()
        .activate(email("user@test.com"))
        .send()
        .await
        .unwrap();

    client
        .user()
        .engaged(email("user@test.com"))
        .send()
        .await
        .unwrap();

    client
        .user()
        .inactive(email("user@test.com"))
        .send()
        .await
        .unwrap();
}

#[tokio::test]
async fn test_billing_events() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(3)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .max_batch_size(1)
        .build()
        .unwrap();

    client
        .customer()
        .trialing("acme.com")
        .send()
        .await
        .unwrap();

    client
        .customer()
        .paid("acme.com")
        .customer_id("cust_123")
        .stripe_customer_id("cus_xxx")
        .send()
        .await
        .unwrap();

    client
        .customer()
        .churned("acme.com")
        .property("reason", "pricing")
        .send()
        .await
        .unwrap();
}

#[tokio::test]
async fn test_flush_on_shutdown() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));
    let received_clone = received.clone();

    Mock::given(method("POST"))
        .respond_with_fn(move |_| {
            received_clone.fetch_add(1, Ordering::SeqCst);
            ResponseTemplate::new(200).set_body_json(json!({
                "success": true,
                "processed": 1
            }))
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100)) // Don't auto-flush
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    // Not flushed yet
    assert_eq!(received.load(Ordering::SeqCst), 0);

    // Shutdown triggers flush
    client.shutdown().await.unwrap();

    assert_eq!(received.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn test_batch_flush_at_max_size() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 5
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .max_batch_size(5)
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Add 5 events - should trigger flush
    for i in 0..5 {
        client
            .track(&format!("event_{}", i), email("user@test.com"))
            .send()
            .await
            .unwrap();
    }

    // Give time for flush to complete
    tokio::time::sleep(Duration::from_millis(100)).await;

    assert_eq!(client.pending_event_count().await, 0);
}

#[tokio::test]
async fn test_shutdown_prevents_further_tracking() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 0
        })))
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .build()
        .unwrap();

    client.shutdown().await.unwrap();

    let result = client
        .track("event", email("user@test.com"))
        .send()
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_track_by_user_id() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .track_by_user_id("test_event", user_id("usr_123"))
        .email("user@test.com")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}
```

**Step 2: Run integration tests**

Run: `cargo test --test integration`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add crates/outlit/tests/integration.rs
git commit -m "test(rust): add integration tests with mock server"
```

---

### Task 10: Add README and Final Documentation

**Files:**
- Create: `crates/outlit/README.md`

**Step 1: Write README**

Create `crates/outlit/README.md`:

```markdown
# outlit

Outlit analytics SDK for Rust.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
outlit = "0.1"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

## Quick Start

```rust
use outlit::{Outlit, email};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), outlit::Error> {
    // Initialize the client
    let client = Outlit::builder("pk_your_public_key")
        .flush_interval(Duration::from_secs(10))
        .build()?;

    // Track a custom event
    client.track("signup", email("user@example.com"))
        .property("plan", "pro")
        .property("source", "landing_page")
        .send()
        .await?;

    // Identify a user (update traits)
    client.identify(email("user@example.com"))
        .user_id("usr_123")
        .trait_("name", "John Doe")
        .trait_("company", "Acme Inc")
        .send()
        .await?;

    // User journey stages
    client.user().activate(email("user@example.com"))
        .property("onboarding_completed", true)
        .send()
        .await?;

    // Customer billing
    client.customer().paid("acme.com")
        .customer_id("cust_123")
        .stripe_customer_id("cus_xxx")
        .send()
        .await?;

    // Important: Flush before shutdown!
    client.shutdown().await?;

    Ok(())
}
```

## Configuration

```rust
let client = Outlit::builder("pk_xxx")
    .api_host("https://custom.example.com")  // default: https://app.outlit.ai
    .flush_interval(Duration::from_secs(5))   // default: 10 seconds
    .max_batch_size(50)                       // default: 100
    .timeout(Duration::from_secs(30))         // default: 10 seconds
    .build()?;
```

## Identity

All methods require identity (email or user_id). Use the helper functions:

```rust
use outlit::{email, user_id};

// Track with email
client.track("event", email("user@example.com")).send().await?;

// Track with user_id
client.track_by_user_id("event", user_id("usr_123")).send().await?;

// Add both identifiers
client.track("event", email("user@example.com"))
    .user_id("usr_123")  // optionally add the other
    .send()
    .await?;
```

## API Reference

### Track

```rust
client.track("event_name", email("..."))
    .property("key", "value")
    .property("count", 42)
    .timestamp(1706400000000)  // optional custom timestamp
    .send()
    .await?;
```

### Identify

Unlike the browser SDK which links anonymous visitors to users, `identify()` in
the Rust SDK is for updating user traits when your app learns new information.

```rust
client.identify(email("user@example.com"))
    .user_id("usr_123")
    .trait_("name", "John")
    .trait_("plan", "pro")
    .send()
    .await?;
```

### User Journey Stages

```rust
client.user().activate(email("...")).send().await?;
client.user().engaged(email("...")).send().await?;
client.user().inactive(email("...")).send().await?;
```

### Customer Billing

```rust
client.customer().trialing("domain.com").send().await?;
client.customer().paid("domain.com")
    .customer_id("cust_123")
    .stripe_customer_id("cus_xxx")
    .send()
    .await?;
client.customer().churned("domain.com")
    .property("reason", "pricing")
    .send()
    .await?;
```

### Lifecycle

```rust
// Force flush pending events
client.flush().await?;

// Shutdown (flushes and stops background tasks)
client.shutdown().await?;
```

## License

MIT
```

**Step 2: Run all tests one final time**

Run: `cargo test`

Expected: All tests PASS

**Step 3: Verify documentation builds**

Run: `cargo doc --no-deps`

Expected: Documentation builds successfully

**Step 4: Commit**

```bash
git add crates/outlit/README.md
git commit -m "docs(rust): add README with usage examples"
```

---

## Summary

After completing all tasks you will have:

1. **TypeScript SDK improvements:**
   - `CustomerTraits` and `IdentifyTraits` interfaces
   - Updated `ServerIdentifyOptions` and `BrowserIdentifyOptions`
   - Type tests verifying the new types work

2. **Rust SDK:**
   - Full client with builder pattern API
   - Compile-time identity safety via `email()` / `user_id()` helpers
   - Event batching with background flush
   - HTTP transport with reqwest
   - Comprehensive unit and integration tests
   - camelCase JSON serialization matching Node SDK
   - Documentation and README

**Total tasks:** 10
**Estimated implementation time:** Varies by developer

---

Plan complete and saved to `docs/plans/2025-01-27-implementation-plan.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
