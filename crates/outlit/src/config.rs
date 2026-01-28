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
