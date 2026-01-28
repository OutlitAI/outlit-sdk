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
