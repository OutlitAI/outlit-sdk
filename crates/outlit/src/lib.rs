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

mod config;
mod error;
mod queue;
mod transport;
mod types;

pub(crate) use queue::EventQueue;
pub(crate) use transport::HttpTransport;

pub use config::{Config, OutlitBuilder};
pub use error::Error;
pub use types::{
    BillingStatus, IngestPayload, IngestResponse, JourneyStage, SourceType, TrackerEvent,
};

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
