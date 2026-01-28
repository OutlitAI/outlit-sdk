//! Outlit analytics SDK for Rust.
//!
//! # Example
//!
//! ```rust,ignore
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
