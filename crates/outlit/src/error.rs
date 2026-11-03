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

impl Error {
    /// Whether sending the same events again can succeed.
    ///
    /// Network failures, timeouts, `408`, `429`, and `5xx` responses are
    /// retryable. Other `4xx` responses (an unknown public key, an invalid or
    /// oversized batch) fail the same way every time, so the client drops
    /// those events instead of requeuing them. A success response whose body
    /// isn't the expected JSON ([`Error::Serialization`]) isn't retried either:
    /// the API already accepted the events, and sending them again would
    /// duplicate them.
    pub fn is_retryable(&self) -> bool {
        match self {
            Error::Http(_) => true,
            Error::Api { status, .. } => matches!(status, 408 | 429 | 500..=599),
            Error::Config(_) | Error::Shutdown | Error::Serialization(_) => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn api(status: u16) -> Error {
        Error::Api {
            status,
            message: String::new(),
        }
    }

    #[test]
    fn test_only_timeouts_rate_limits_and_server_errors_are_retryable() {
        for status in [408, 429, 500, 502, 503, 504] {
            assert!(api(status).is_retryable(), "{status} should be retried");
        }
        for status in [400, 401, 403, 404, 413, 422] {
            assert!(!api(status).is_retryable(), "{status} should be dropped");
        }
    }
}
