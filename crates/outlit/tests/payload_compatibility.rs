//! Tests to verify Rust SDK payload matches TypeScript SDK format.
//!
//! These tests serialize events and verify the JSON structure matches
//! what the server expects (based on TypeScript types).

use outlit::types::{
    BillingEventData, BillingStatus, CustomEventData, IdentifyEventData, JourneyStage,
    StageEventData,
};
use outlit::{IngestPayload, SourceType, TrackerEvent};
use serde_json::json;

#[test]
fn test_custom_event_json_structure() {
    let event = TrackerEvent::Custom(CustomEventData {
        timestamp: 1706400000000,
        url: "server://user@test.com".into(),
        path: "/".into(),
        event_name: "signup".into(),
        properties: Some([("plan".to_string(), json!("pro"))].into_iter().collect()),
    });

    let json = serde_json::to_value(&event).unwrap();

    // Verify camelCase field names (TypeScript uses camelCase)
    assert_eq!(json["type"], "custom");
    assert_eq!(json["eventName"], "signup"); // camelCase, not event_name
    assert!(json.get("event_name").is_none()); // snake_case should NOT exist

    // Verify required fields exist
    assert!(json.get("timestamp").is_some());
    assert!(json.get("url").is_some());
    assert!(json.get("path").is_some());
    assert!(json.get("properties").is_some());
}

#[test]
fn test_identify_event_json_structure() {
    let event = TrackerEvent::Identify(IdentifyEventData {
        timestamp: 1706400000000,
        url: "server://user@test.com".into(),
        path: "/".into(),
        email: Some("user@test.com".into()),
        user_id: Some("usr_123".into()),
        traits: Some([("name".to_string(), json!("John"))].into_iter().collect()),
    });

    let json = serde_json::to_value(&event).unwrap();

    assert_eq!(json["type"], "identify");
    assert_eq!(json["userId"], "usr_123"); // camelCase
    assert!(json.get("user_id").is_none()); // snake_case should NOT exist
    assert_eq!(json["email"], "user@test.com");
    assert!(json.get("traits").is_some());
}

#[test]
fn test_stage_event_json_structure() {
    let event = TrackerEvent::Stage(StageEventData {
        timestamp: 1706400000000,
        url: "server://user@test.com".into(),
        path: "/".into(),
        stage: JourneyStage::Activated,
        properties: None,
    });

    let json = serde_json::to_value(&event).unwrap();

    assert_eq!(json["type"], "stage");
    assert_eq!(json["stage"], "activated"); // lowercase enum value
}

#[test]
fn test_billing_event_json_structure() {
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
    assert_eq!(json["status"], "paid"); // lowercase enum value
    assert_eq!(json["customerId"], "cust_123"); // camelCase
    assert_eq!(json["stripeCustomerId"], "cus_xxx"); // camelCase
    assert!(json.get("customer_id").is_none()); // snake_case should NOT exist
}

#[test]
fn test_ingest_payload_json_structure() {
    let payload = IngestPayload {
        source: SourceType::Server,
        events: vec![],
    };

    let json = serde_json::to_value(&payload).unwrap();

    assert_eq!(json["source"], "server"); // lowercase enum value
    assert!(json["events"].is_array());

    // Server payloads should NOT have visitorId (that's for browser SDK)
    // This is intentional - the TypeScript types show visitorId as optional
}

#[test]
fn test_nested_customer_traits_structure() {
    // This matches the TypeScript CustomerTraits interface
    let event = TrackerEvent::Identify(IdentifyEventData {
        timestamp: 1706400000000,
        url: "server://user@test.com".into(),
        path: "/".into(),
        email: Some("user@test.com".into()),
        user_id: None,
        traits: Some(
            [
                ("name".to_string(), json!("John")),
                (
                    "customer".to_string(),
                    json!({
                        "plan": "enterprise",
                        "mrr": 5000
                    }),
                ),
            ]
            .into_iter()
            .collect(),
        ),
    });

    let json = serde_json::to_value(&event).unwrap();

    // Verify nested customer traits work
    assert_eq!(json["traits"]["name"], "John");
    assert_eq!(json["traits"]["customer"]["plan"], "enterprise");
    assert_eq!(json["traits"]["customer"]["mrr"], 5000);
}

/// Print the actual JSON for manual inspection
#[test]
fn test_print_example_payloads() {
    // Custom event
    let custom = TrackerEvent::Custom(CustomEventData {
        timestamp: 1706400000000,
        url: "server://user@test.com".into(),
        path: "/".into(),
        event_name: "signup".into(),
        properties: Some([("plan".to_string(), json!("pro"))].into_iter().collect()),
    });

    // Full payload
    let payload = IngestPayload {
        source: SourceType::Server,
        events: vec![custom],
    };

    let json = serde_json::to_string_pretty(&payload).unwrap();
    println!("Example IngestPayload:\n{}", json);

    // This should match TypeScript output:
    // {
    //   "source": "server",
    //   "events": [
    //     {
    //       "type": "custom",
    //       "timestamp": 1706400000000,
    //       "url": "server://user@test.com",
    //       "path": "/",
    //       "eventName": "signup",
    //       "properties": { "plan": "pro" }
    //     }
    //   ]
    // }
}
