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
pub mod types;

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

/// Create a fingerprint identity (device identifier).
pub fn fingerprint(fp: impl Into<String>) -> Fingerprint {
    Fingerprint(fp.into())
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

/// Fingerprint identity wrapper (device identifier).
#[derive(Debug, Clone)]
pub struct Fingerprint(pub(crate) String);

impl Fingerprint {
    /// Get the fingerprint as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<Fingerprint> for String {
    fn from(fp: Fingerprint) -> String {
        fp.0
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
