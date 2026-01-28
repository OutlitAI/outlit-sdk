//! Error types for the Outlit SDK.

/// Errors that can occur when using the Outlit SDK.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// HTTP request failed.
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// API returned an error response.
    #[error("API error (status {status}): {message}")]
    Api {
        /// HTTP status code.
        status: u16,
        /// Error message from the API.
        message: String,
    },

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
