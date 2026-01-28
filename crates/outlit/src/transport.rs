//! HTTP transport for sending events.

use crate::config::Config;
use crate::types::{IngestPayload, IngestResponse};
use crate::Error;
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
