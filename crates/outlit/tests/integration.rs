//! Integration tests for the Outlit SDK.

use outlit::{email, fingerprint, user_id, Outlit};
use serde_json::json;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use wiremock::matchers::{header, method, path};
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
        .api_host(mock_server.uri())
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
        .api_host(mock_server.uri())
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

struct DelayedFailuresResponder {
    counter: Arc<AtomicUsize>,
    delays: Vec<Duration>,
}

impl wiremock::Respond for DelayedFailuresResponder {
    fn respond(&self, _request: &wiremock::Request) -> ResponseTemplate {
        let call = self.counter.fetch_add(1, Ordering::SeqCst);
        if let Some(delay) = self.delays.get(call) {
            return ResponseTemplate::new(500).set_delay(*delay);
        }

        ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        }))
    }
}

async fn wait_for_call_count(counter: &AtomicUsize, expected: usize) {
    tokio::time::timeout(Duration::from_secs(1), async {
        while counter.load(Ordering::SeqCst) < expected {
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await
    .expect("mock request was not received in time");
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
        .api_host(mock_server.uri())
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
async fn test_shutdown_waits_for_a_drained_periodic_batch_before_final_flush() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(DelayedFailuresResponder {
            counter: received.clone(),
            delays: vec![Duration::from_millis(100)],
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_millis(10))
        .max_batch_size(100)
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    wait_for_call_count(&received, 1).await;
    client.shutdown().await.unwrap();

    assert_eq!(received.load(Ordering::SeqCst), 2);
    assert_eq!(client.pending_event_count().await, 0);
}

#[tokio::test]
async fn test_concurrent_failed_flushes_preserve_global_event_order() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(DelayedFailuresResponder {
            counter: received.clone(),
            delays: vec![Duration::from_millis(100), Duration::from_millis(200)],
        })
        .mount(&mock_server)
        .await;

    let client = Arc::new(
        Outlit::builder("pk_test")
            .api_host(mock_server.uri())
            .flush_interval(Duration::from_secs(100))
            .max_batch_size(100)
            .build()
            .unwrap(),
    );

    client
        .track("older", email("user@test.com"))
        .send()
        .await
        .unwrap();
    let first_client = client.clone();
    let first_flush = tokio::spawn(async move { first_client.flush().await });
    wait_for_call_count(&received, 1).await;

    client
        .track("newer", email("user@test.com"))
        .send()
        .await
        .unwrap();
    let second_client = client.clone();
    let second_flush = tokio::spawn(async move { second_client.flush().await });

    assert!(first_flush.await.unwrap().is_err());
    assert!(second_flush.await.unwrap().is_err());
    client.flush().await.unwrap();

    let requests = mock_server.received_requests().await.unwrap();
    let final_payload: serde_json::Value = serde_json::from_slice(&requests.last().unwrap().body)
        .expect("final request must contain JSON");
    let event_names = final_payload["events"]
        .as_array()
        .unwrap()
        .iter()
        .map(|event| event["eventName"].as_str().unwrap())
        .collect::<Vec<_>>();

    assert_eq!(received.load(Ordering::SeqCst), 3);
    assert_eq!(event_names, vec!["older", "newer"]);
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
        .api_host(mock_server.uri())
        .max_batch_size(5)
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Add 5 events - should trigger flush
    for i in 0..5 {
        client
            .track(format!("event_{i}"), email("user@test.com"))
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
        .api_host(mock_server.uri())
        .build()
        .unwrap();

    client.shutdown().await.unwrap();

    let result = client.track("event", email("user@test.com")).send().await;

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
        .api_host(mock_server.uri())
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

#[tokio::test]
async fn test_flush_empty_queue_is_noop() {
    let mock_server = MockServer::start().await;

    // Expect NO calls - flush on empty queue should not hit the server
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 0
        })))
        .expect(0)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Flush with no events should succeed without hitting server
    client.flush().await.unwrap();
    client.flush().await.unwrap(); // Multiple calls should also work
}

#[tokio::test]
async fn test_periodic_flush_timer() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(CountingResponder {
            counter: received.clone(),
        })
        .mount(&mock_server)
        .await;

    // Set a very short flush interval
    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_millis(50))
        .max_batch_size(100) // Large batch size so it doesn't trigger size-based flush
        .build()
        .unwrap();

    // Add an event
    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    // Should not be flushed immediately
    assert_eq!(received.load(Ordering::SeqCst), 0);

    // Wait for periodic flush to trigger (50ms interval + some buffer)
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Should have been flushed by timer
    assert_eq!(received.load(Ordering::SeqCst), 1);
    assert_eq!(client.pending_event_count().await, 0);

    client.shutdown().await.unwrap();
}

#[tokio::test]
async fn test_shutdown_idempotent() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1) // Only one flush should happen despite multiple shutdowns
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    // Multiple shutdowns should be safe
    client.shutdown().await.unwrap();
    client.shutdown().await.unwrap();
    client.shutdown().await.unwrap();
}

#[tokio::test]
async fn test_concurrent_shutdown_waits_and_retries_a_failed_flush() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(DelayedFailuresResponder {
            counter: received.clone(),
            delays: vec![Duration::from_millis(100)],
        })
        .mount(&mock_server)
        .await;

    let client = Arc::new(
        Outlit::builder("pk_test")
            .api_host(mock_server.uri())
            .flush_interval(Duration::from_secs(100))
            .build()
            .unwrap(),
    );

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    let first_client = client.clone();
    let first_shutdown = tokio::spawn(async move { first_client.shutdown().await });
    wait_for_call_count(&received, 1).await;

    let second_client = client.clone();
    let second_shutdown = tokio::spawn(async move { second_client.shutdown().await });
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert!(!second_shutdown.is_finished());

    assert!(first_shutdown.await.unwrap().is_err());
    second_shutdown.await.unwrap().unwrap();
    assert_eq!(received.load(Ordering::SeqCst), 2);
    assert_eq!(client.pending_event_count().await, 0);
}

#[tokio::test]
async fn test_flush_http_error_returns_error() {
    let mock_server = MockServer::start().await;

    // Server returns 500 error
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(500).set_body_json(json!({
            "error": "Internal server error"
        })))
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    // Flush should return error on HTTP failure
    let result = client.flush().await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_multiple_batches_flush_correctly() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(CountingResponder {
            counter: received.clone(),
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .max_batch_size(3)
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Add 7 events - should trigger 2 flushes (at 3 and 6), with 1 remaining
    for i in 0..7 {
        client
            .track(format!("event_{i}"), email("user@test.com"))
            .send()
            .await
            .unwrap();
    }

    // Give time for async flushes
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Should have flushed twice (at 3 events, and at 6 events)
    assert_eq!(received.load(Ordering::SeqCst), 2);

    // 1 event should remain pending
    assert_eq!(client.pending_event_count().await, 1);

    // Final flush
    client.flush().await.unwrap();
    assert_eq!(received.load(Ordering::SeqCst), 3);
    assert_eq!(client.pending_event_count().await, 0);
}

// ============================================
// FINGERPRINT TESTS
// ============================================

#[tokio::test]
async fn test_track_with_fingerprint_only() {
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
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Track with fingerprint only (anonymous user)
    client
        .track_by_fingerprint("page_view", fingerprint("device_abc123"))
        .property("page", "/pricing")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_track_with_fingerprint_and_email() {
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
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Track with email + fingerprint (links device to user)
    client
        .track("signup", email("user@test.com"))
        .fingerprint("device_abc123")
        .property("plan", "pro")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_track_with_fingerprint_and_user_id() {
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
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Track with fingerprint + user_id
    client
        .track_by_fingerprint("feature_used", fingerprint("device_abc123"))
        .user_id("usr_123")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_identify_with_fingerprint_links_device() {
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
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    // Identify with email + fingerprint to link device
    client
        .identify(email("user@test.com"))
        .fingerprint("device_abc123")
        .user_id("usr_123")
        .trait_("name", "John")
        .send()
        .await
        .unwrap();

    client.flush().await.unwrap();
}

#[tokio::test]
async fn test_requests_identify_the_sdk_in_the_user_agent() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(header(
            "user-agent",
            concat!("outlit-rust/", env!("CARGO_PKG_VERSION")),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": true,
            "processed": 1
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();
    client.flush().await.unwrap();
}

/// Responds with a fixed status and counts the calls.
struct StatusResponder {
    counter: Arc<AtomicUsize>,
    statuses: Vec<u16>,
}

impl wiremock::Respond for StatusResponder {
    fn respond(&self, _request: &wiremock::Request) -> ResponseTemplate {
        let call = self.counter.fetch_add(1, Ordering::SeqCst);
        let status = self.statuses.get(call).or(self.statuses.last()).copied();
        match status {
            Some(status) if status >= 400 => ResponseTemplate::new(status).set_body_json(json!({
                "success": false,
                "processed": 0,
                "errors": [{ "index": -1, "message": "Invalid or inactive tracking configuration" }]
            })),
            _ => ResponseTemplate::new(200).set_body_json(json!({
                "success": true,
                "processed": 1
            })),
        }
    }
}

async fn client_answered_with(
    statuses: Vec<u16>,
    flush_interval: Duration,
) -> (Outlit, Arc<AtomicUsize>, MockServer) {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(StatusResponder {
            counter: received.clone(),
            statuses,
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_unknown")
        .api_host(mock_server.uri())
        .flush_interval(flush_interval)
        .build()
        .unwrap();
    (client, received, mock_server)
}

#[tokio::test]
async fn test_non_retryable_rejections_drop_the_batch() {
    for status in [400, 401, 403, 404, 413, 422] {
        let (client, received, _server) =
            client_answered_with(vec![status], Duration::from_secs(100)).await;

        client
            .track("event", email("user@test.com"))
            .send()
            .await
            .unwrap();

        let error = client.flush().await.unwrap_err();
        assert!(
            matches!(error, outlit::Error::Api { status: s, .. } if s == status),
            "{status}: {error}"
        );
        assert!(!error.is_retryable());
        assert_eq!(
            client.pending_event_count().await,
            0,
            "{status} must not requeue"
        );

        // Nothing is left to resend.
        client.flush().await.unwrap();
        client.shutdown().await.unwrap();
        assert_eq!(received.load(Ordering::SeqCst), 1, "{status} was resent");
    }
}

#[tokio::test]
async fn test_an_unknown_public_key_is_not_retried_by_the_timer() {
    let (client, received, _server) =
        client_answered_with(vec![400], Duration::from_millis(20)).await;

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;

    // One attempt for the one batch, not one per timer tick.
    assert_eq!(received.load(Ordering::SeqCst), 1);
    assert_eq!(client.pending_event_count().await, 0);
    client.shutdown().await.unwrap();
}

#[tokio::test]
async fn test_retryable_failures_keep_the_batch() {
    for status in [408, 429, 500, 503] {
        let (client, received, _server) =
            client_answered_with(vec![status, 200], Duration::from_secs(100)).await;

        client
            .track("event", email("user@test.com"))
            .send()
            .await
            .unwrap();

        let error = client.flush().await.unwrap_err();
        assert!(error.is_retryable(), "{status}: {error}");
        assert_eq!(
            client.pending_event_count().await,
            1,
            "{status} must requeue"
        );

        client.flush().await.unwrap();
        assert_eq!(client.pending_event_count().await, 0);
        assert_eq!(received.load(Ordering::SeqCst), 2);
        client.shutdown().await.unwrap();
    }
}

#[tokio::test]
async fn test_timer_retries_back_off_while_the_api_keeps_failing() {
    let (client, received, _server) =
        client_answered_with(vec![503], Duration::from_millis(20)).await;

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_millis(400)).await;

    // Without backoff this is ~20 attempts; doubling from 20ms allows about
    // five (20, 40, 80, 160, 320ms apart).
    let attempts = received.load(Ordering::SeqCst);
    assert!((2..=6).contains(&attempts), "{attempts} attempts");
}

#[tokio::test]
async fn test_a_rejected_batch_does_not_hold_back_the_others() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(StatusResponder {
            counter: received.clone(),
            statuses: vec![503, 422, 200],
        })
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .max_batch_size(1)
        .build()
        .unwrap();

    // The first send's flush fails with 503, so the event is requeued and
    // automatic flushes back off; the second send only queues.
    assert!(client
        .track("first", email("user@test.com"))
        .send()
        .await
        .is_err());
    client
        .track("second", email("user@test.com"))
        .send()
        .await
        .unwrap();
    assert_eq!(received.load(Ordering::SeqCst), 1);
    assert_eq!(client.pending_event_count().await, 2);

    // One flush, two batches: the first is rejected and dropped, the second
    // still goes out.
    let error = client.flush().await.unwrap_err();
    assert!(matches!(error, outlit::Error::Api { status: 422, .. }));
    assert_eq!(client.pending_event_count().await, 0);

    let requests = mock_server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 3);
    let last: serde_json::Value = serde_json::from_slice(&requests[2].body).unwrap();
    assert_eq!(last["events"][0]["eventName"], "second");
}

#[tokio::test]
async fn test_queued_size_triggered_flushes_respect_a_backoff_set_while_they_waited() {
    let mock_server = MockServer::start().await;
    let received = Arc::new(AtomicUsize::new(0));

    Mock::given(method("POST"))
        .respond_with(DelayedFailuresResponder {
            counter: received.clone(),
            delays: vec![Duration::from_millis(100)],
        })
        .mount(&mock_server)
        .await;

    let client = Arc::new(
        Outlit::builder("pk_test")
            .api_host(mock_server.uri())
            .flush_interval(Duration::from_secs(100))
            .max_batch_size(1)
            .build()
            .unwrap(),
    );

    // The first send's flush is in flight (and will fail with 500) while
    // more sends queue up behind the flush lock.
    let first_client = client.clone();
    let first = tokio::spawn(async move {
        first_client
            .track("event_0", email("user@test.com"))
            .send()
            .await
    });
    wait_for_call_count(&received, 1).await;

    let mut waiting = Vec::new();
    for i in 1..10 {
        let client = client.clone();
        waiting.push(tokio::spawn(async move {
            client
                .track(format!("event_{i}"), email("user@test.com"))
                .send()
                .await
        }));
    }

    assert!(first.await.unwrap().is_err());
    for send in waiting {
        send.await.unwrap().unwrap();
    }

    // The failure set the backoff before any queued caller got the lock.
    assert_eq!(received.load(Ordering::SeqCst), 1);
    assert_eq!(client.pending_event_count().await, 10);
}

#[tokio::test]
async fn test_a_success_response_that_is_not_json_is_not_resent() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_string("<html>ok</html>"))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = Outlit::builder("pk_test")
        .api_host(mock_server.uri())
        .flush_interval(Duration::from_secs(100))
        .build()
        .unwrap();

    client
        .track("event", email("user@test.com"))
        .send()
        .await
        .unwrap();

    let error = client.flush().await.unwrap_err();
    assert!(matches!(error, outlit::Error::Serialization(_)), "{error}");
    assert_eq!(client.pending_event_count().await, 0);
    client.flush().await.unwrap();
}
