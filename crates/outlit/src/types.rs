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
    pub fingerprint: Option<String>,
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
            properties: Some(HashMap::from([("plan".into(), json!("pro"))])),
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "custom");
        assert_eq!(json["eventName"], "signup"); // camelCase
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
            fingerprint: None,
            traits: None,
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "identify");
        assert_eq!(json["userId"], "usr_123"); // camelCase
    }

    #[test]
    fn test_identify_event_with_fingerprint() {
        let event = TrackerEvent::Identify(IdentifyEventData {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            email: Some("user@example.com".into()),
            user_id: Some("usr_123".into()),
            fingerprint: Some("device_abc123".into()),
            traits: None,
        });

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["type"], "identify");
        assert_eq!(json["fingerprint"], "device_abc123");
        assert_eq!(json["email"], "user@example.com");
        assert_eq!(json["userId"], "usr_123");
    }

    #[test]
    fn test_fingerprint_omitted_when_none() {
        let event = TrackerEvent::Identify(IdentifyEventData {
            timestamp: 1706400000000,
            url: "server://user@example.com".into(),
            path: "/".into(),
            email: Some("user@example.com".into()),
            user_id: None,
            fingerprint: None,
            traits: None,
        });

        let json_str = serde_json::to_string(&event).unwrap();

        assert!(!json_str.contains("fingerprint"));
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
        assert_eq!(json["customerId"], "cust_123"); // camelCase
        assert_eq!(json["stripeCustomerId"], "cus_xxx"); // camelCase
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
        assert!(json.get("visitorId").is_none()); // server events don't have visitorId
    }
}
