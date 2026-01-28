//! Integration tests for the Outlit SDK.

use outlit::{email, user_id, Outlit};
use serde_json::json;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_track_sends_correct_payload() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/i/v1/pk_test/events"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100)) // Don't auto-flush
        .build()
        .unwrap();

    client
        .track("test_event", email("user@test.com"))
        .property("plan", "pro")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_identify_sends_correct_payload() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/i/v1/pk_test/events"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .identify(email("user@test.com"))
        .user_id("usr_123")
        .trait_("name", "John")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_stage_events() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(3)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .max_batch_size(1) // Flush after each event
        .build()
        .unwrap();

    client
        .user()
        .activate(email("user@test.com"))
        .send()
        .await
        .unwrap();

    client
        .user()
        .engaged(email("user@test.com"))
        .send()
        .await
        .unwrap();

    client
        .user()
        .inactive(email("user@test.com"))
        .send()
        .await
        .unwrap();
}

#[tokio::test]
async fn test_billing_events() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(3)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .max_batch_size(1)
        .build()
        .unwrap();

    client
        .customer()
        .trialing("acme.com")
        .send()
        .await
        .unwrap();

    client
        .customer()
        .paid("acme.com")
        .customer_id("cust_123")
        .stripe_customer_id("cus_xxx")
        .send()
        .await
        .unwrap();

    client
        .customer()
        .churned("acme.com")
        .property("reason", "pricing")
        .send()
        .await
        .unwrap();
}

/// Custom responder that counts calls
struct CountingResponder {
    counter: Arc<AtomicUsize>,
}

impl wiremock::Respond for CountingResponder {
    fn respond(&self, _request: &wiremock::Request) -> ResponseTemplate {
        self.counter.fetch_add(1, Ordering::SeqCst);
        ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        }))
    }
}

#[tokio::test]
async fn test_flush_on_shutdown() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(CountingResponder {
            counter: received.clone(),
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100)) // Don't auto-flush
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    // Not flushed yet
    assert_eq!(received.load(Ordering::SeqCst), 0);

    // Shutdown triggers flush
    client.shutdown().await.unwrap();

    assert_eq!(received.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn test_batch_flush_at_max_size() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 5
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .max_batch_size(5)
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Add 5 events - should trigger flush
    for i in 0..5 {
        client
            .track(&format!("event_{}", i), email("user@test.com"))
            .send()
            .await
            .unwrap();
    }

    // Give time for flush to complete
    tokio::time::sleep(Duration::from_millis(100)).await;

    assert_eq!(client.pending_event_count().await, 0);
}

#[tokio::test]
async fn test_shutdown_prevents_further_tracking() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 0
        })))
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .build()
        .unwrap();

    client.shutdown().await.unwrap();

    let result = client
        .track("event", email("user@test.com"))
        .send()
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_track_by_user_id() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(&mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .track_by_user_id("test_event", user_id("usr_123"))
        .email("user@test.com")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}
