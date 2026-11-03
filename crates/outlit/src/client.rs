//! Outlit client implementation.

use crate::builders::{IdentifyBuilder, TrackBuilder};
use crate::config::{Config, OutlitBuilder};
use crate::queue::EventQueue;
use crate::transport::HttpTransport;
use crate::types::{IngestPayload, SourceType, TrackerEvent};
use crate::{Email, Error, Fingerprint, UserId};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::{interval, Instant};
use tracing::{debug, error, info, instrument};

/// Longest wait between automatic retries of a failing send.
const MAX_RETRY_BACKOFF: Duration = Duration::from_secs(300);

/// Outlit analytics client.
///
/// Supports tracking with email, user_id, or fingerprint identity.
/// Events tracked with fingerprint only can be linked to users later
/// via an identify call with the same fingerprint.
///
/// # Example
///
/// ```rust,no_run
/// use outlit::{Outlit, email, fingerprint};
/// use std::time::Duration;
///
/// #[tokio::main]
/// async fn main() -> Result<(), outlit::Error> {
///     let client = Outlit::builder("pk_xxx")
///         .flush_interval(Duration::from_secs(5))
///         .build()?;
///
///     // Track with email (resolves immediately)
///     client.track("signup", email("user@example.com"))
///         .property("plan", "pro")
///         .send()
///         .await?;
///
///     // Track with fingerprint only (stored for later backfill)
///     client.track_by_fingerprint("page_view", fingerprint("device_abc123"))
///         .property("page", "/pricing")
///         .send()
///         .await?;
///
///     // Link fingerprint to user
///     client.identify(email("user@example.com"))
///         .fingerprint("device_abc123")
///         .send()
///         .await?;
///
///     client.shutdown().await?;
///     Ok(())
/// }
/// ```
pub struct Outlit {
    config: Config,
    queue: Arc<EventQueue>,
    transport: Arc<HttpTransport>,
    is_shutdown: Arc<AtomicBool>,
    lifecycle_lock: Mutex<()>,
    shutdown_lock: Mutex<()>,
    flush_lock: Arc<Mutex<()>>,
    flush_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
    backoff: Arc<RetryBackoff>,
}

impl Outlit {
    /// Create a new builder with the given public key.
    pub fn builder(public_key: impl Into<String>) -> OutlitBuilder {
        OutlitBuilder::new(public_key)
    }

    /// Create a new client from config.
    pub(crate) fn from_config(config: Config) -> Result<Self, Error> {
        let queue = Arc::new(EventQueue::new(config.max_batch_size()));
        let transport = Arc::new(HttpTransport::new(&config)?);
        let backoff = Arc::new(RetryBackoff::new(config.flush_interval()));

        let client = Self {
            config,
            queue,
            transport,
            is_shutdown: Arc::new(AtomicBool::new(false)),
            lifecycle_lock: Mutex::new(()),
            shutdown_lock: Mutex::new(()),
            flush_lock: Arc::new(Mutex::new(())),
            flush_handle: Mutex::new(None),
            backoff,
        };

        client.start_flush_timer();

        Ok(client)
    }

    /// Get the client configuration.
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Get the number of pending events.
    pub async fn pending_event_count(&self) -> usize {
        self.queue.len().await
    }

    // ============================================
    // TRACK
    // ============================================

    /// Track a custom event.
    ///
    /// Requires identity (email or user_id) to be provided.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use outlit::{Outlit, email};
    /// # async fn example(client: &Outlit) -> Result<(), outlit::Error> {
    /// client.track("feature_used", email("user@example.com"))
    ///     .property("feature", "export")
    ///     .send()
    ///     .await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn track(
        &self,
        event_name: impl Into<String>,
        identity: impl Into<Email>,
    ) -> SendableTrack<'_> {
        SendableTrack {
            builder: TrackBuilder::new(event_name, identity.into()),
            client: self,
        }
    }

    /// Track a custom event with user_id.
    pub fn track_by_user_id(
        &self,
        event_name: impl Into<String>,
        identity: impl Into<UserId>,
    ) -> SendableTrack<'_> {
        SendableTrack {
            builder: TrackBuilder::new(event_name, identity.into()),
            client: self,
        }
    }

    /// Track a custom event with fingerprint (device identifier).
    ///
    /// Use this for anonymous tracking before the user is identified.
    /// Events can be linked to a user later via `identify()` with the same fingerprint.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use outlit::{Outlit, fingerprint};
    /// # async fn example(client: &Outlit) -> Result<(), outlit::Error> {
    /// client.track_by_fingerprint("page_view", fingerprint("device_abc123"))
    ///     .property("page", "/pricing")
    ///     .send()
    ///     .await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn track_by_fingerprint(
        &self,
        event_name: impl Into<String>,
        identity: impl Into<Fingerprint>,
    ) -> SendableTrack<'_> {
        SendableTrack {
            builder: TrackBuilder::new(event_name, identity.into()),
            client: self,
        }
    }

    // ============================================
    // IDENTIFY
    // ============================================

    /// Identify or update a user.
    ///
    /// Unlike the browser SDK which links anonymous visitors to users,
    /// the Rust SDK's `identify()` is for updating user data when your
    /// app learns new information about them (login, settings change, etc.)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use outlit::{Outlit, email};
    /// # async fn example(client: &Outlit) -> Result<(), outlit::Error> {
    /// client.identify(email("user@example.com"))
    ///     .user_id("usr_123")
    ///     .trait_("name", "John Doe")
    ///     .send()
    ///     .await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn identify(&self, identity: impl Into<Email>) -> SendableIdentify<'_> {
        SendableIdentify {
            builder: IdentifyBuilder::new(identity.into()),
            client: self,
        }
    }

    /// Identify by user_id.
    pub fn identify_by_user_id(&self, identity: impl Into<UserId>) -> SendableIdentify<'_> {
        SendableIdentify {
            builder: IdentifyBuilder::new(identity.into()),
            client: self,
        }
    }

    // ============================================
    // LIFECYCLE
    // ============================================

    /// Flush all pending events immediately.
    ///
    /// Events the API rejects for good (see [`Error::is_retryable`]) are
    /// dropped, and the error is returned. Events that failed for a retryable
    /// reason stay queued; the background timer retries them with backoff.
    ///
    /// Important: Call this before your application exits!
    #[instrument(skip(self))]
    pub async fn flush(&self) -> Result<(), Error> {
        let _flush_guard = self.flush_lock.lock().await;
        flush_queued_events(
            &self.queue,
            &self.transport,
            &self.backoff,
            self.config.max_batch_size(),
            false,
        )
        .await
    }

    /// Shutdown the client gracefully.
    ///
    /// Flushes remaining events and stops the background flush timer.
    #[instrument(skip(self))]
    pub async fn shutdown(&self) -> Result<(), Error> {
        // Concurrent callers share shutdown completion. If an earlier flush
        // failed and requeued events, the next caller retries them.
        let _shutdown_guard = self.shutdown_lock.lock().await;

        // Serialize shutdown admission with sends so every send accepted
        // before shutdown is visible to the final flush.
        let first_shutdown = {
            let _lifecycle_guard = self.lifecycle_lock.lock().await;
            !self.is_shutdown.swap(true, Ordering::SeqCst)
        };

        if first_shutdown {
            info!("shutting down client");
        }

        // Wait for an active flush to finish before stopping the timer. This
        // prevents cancellation from dropping events already drained from the queue.
        let _flush_guard = self.flush_lock.lock().await;
        if let Some(handle) = self.flush_handle.lock().await.take() {
            handle.abort();
        }

        flush_queued_events(
            &self.queue,
            &self.transport,
            &self.backoff,
            self.config.max_batch_size(),
            false,
        )
        .await
    }

    // ============================================
    // INTERNAL
    // ============================================

    fn ensure_not_shutdown(&self) -> Result<(), Error> {
        if self.is_shutdown.load(Ordering::SeqCst) {
            return Err(Error::Shutdown);
        }
        Ok(())
    }

    fn start_flush_timer(&self) {
        let queue = self.queue.clone();
        let transport = self.transport.clone();
        let flush_interval = self.config.flush_interval();
        let is_shutdown = self.is_shutdown.clone();
        let flush_lock = self.flush_lock.clone();
        let backoff = self.backoff.clone();

        let handle = tokio::spawn(async move {
            let mut timer = interval(flush_interval);
            // Tokio intervals tick immediately once; consume that tick so the
            // configured interval means "wait this long before periodic flush".
            timer.tick().await;

            loop {
                timer.tick().await;

                // Check if shutdown
                if is_shutdown.load(Ordering::SeqCst) {
                    break;
                }

                let _flush_guard = flush_lock.lock().await;
                if is_shutdown.load(Ordering::SeqCst) {
                    break;
                }
                // Checked under the flush lock, so a failure that just set the
                // backoff is seen here.
                if backoff.is_waiting() {
                    continue;
                }

                let _ =
                    flush_queued_events(&queue, &transport, &backoff, queue.max_size(), true).await;
            }
        });

        // Store handle but don't block on it
        let flush_handle = self.flush_handle.try_lock();
        if let Ok(mut guard) = flush_handle {
            *guard = Some(handle);
        }
    }

    async fn enqueue_and_maybe_flush(&self, builder: impl BuildEvent) -> Result<(), Error> {
        let should_flush = {
            let _lifecycle_guard = self.lifecycle_lock.lock().await;
            self.ensure_not_shutdown()?;

            let event = builder.build();
            self.queue.enqueue(event).await;
            self.queue.should_flush().await
        };

        if should_flush {
            self.flush_unless_backing_off().await?;
        }

        Ok(())
    }

    /// A size-triggered flush. While retries are backing off, a full queue
    /// waits for the timer instead of sending on every new event. The check
    /// happens under the flush lock, so callers queued behind a failing send
    /// see the backoff it set instead of each retrying in turn.
    async fn flush_unless_backing_off(&self) -> Result<(), Error> {
        let _flush_guard = self.flush_lock.lock().await;
        if self.backoff.is_waiting() {
            return Ok(());
        }
        flush_queued_events(
            &self.queue,
            &self.transport,
            &self.backoff,
            self.config.max_batch_size(),
            false,
        )
        .await
    }
}

async fn flush_queued_events(
    queue: &EventQueue,
    transport: &HttpTransport,
    backoff: &RetryBackoff,
    max_batch_size: usize,
    periodic: bool,
) -> Result<(), Error> {
    if queue.is_empty().await {
        return Ok(());
    }

    let events = queue.drain().await;
    if events.is_empty() {
        return Ok(());
    }

    if periodic {
        debug!(event_count = events.len(), "periodic flush");
    } else {
        info!(event_count = events.len(), "flushing events");
    }

    match send_events_in_batches(transport, events, max_batch_size).await {
        Ok(()) => {
            backoff.reset();
            Ok(())
        }
        Err(SendFailure::Rejected(error)) => {
            backoff.reset();
            Err(error)
        }
        Err(SendFailure::Retryable(error, unsent_events)) => {
            let delay = backoff.record_failure();
            if periodic {
                error!(error = %error, retry_in = ?delay, "periodic flush failed, requeuing events");
            } else {
                error!(error = %error, retry_in = ?delay, "flush failed, requeuing events");
            }
            queue.requeue(unsent_events).await;
            Err(error)
        }
    }
}

/// Why a flush didn't send everything.
enum SendFailure {
    /// The API rejected at least one batch for good; those events were dropped.
    Rejected(Error),
    /// A batch failed for a retryable reason; these events are still unsent.
    Retryable(Error, Vec<TrackerEvent>),
}

/// Sends events in batches. A batch the API rejects for good is dropped and
/// the remaining batches still go out. A retryable failure stops the flush and
/// hands back the failed batch and everything after it.
async fn send_events_in_batches(
    transport: &HttpTransport,
    mut events: Vec<TrackerEvent>,
    max_batch_size: usize,
) -> Result<(), SendFailure> {
    let mut rejected = None;
    while !events.is_empty() {
        let remaining = if events.len() > max_batch_size {
            events.split_off(max_batch_size)
        } else {
            Vec::new()
        };
        let payload = IngestPayload {
            source: SourceType::Server,
            events,
        };

        if let Err(error) = transport.send(&payload).await {
            if error.is_retryable() {
                let mut unsent_events = payload.events;
                unsent_events.extend(remaining);
                return Err(SendFailure::Retryable(error, unsent_events));
            }
            log_rejected_batch(&error, payload.events.len());
            rejected.get_or_insert(error);
        }

        events = remaining;
    }

    match rejected {
        Some(error) => Err(SendFailure::Rejected(error)),
        None => Ok(()),
    }
}

/// Statuses whose dropped batches have already been logged at error level.
/// `0` stands for a success response whose body couldn't be decoded.
static LOGGED_REJECTIONS: std::sync::Mutex<Vec<u16>> = std::sync::Mutex::new(Vec::new());

/// Logs a dropped batch at error level the first time its status is seen in
/// this process, and at debug level after that. A rejection like an unknown
/// public key repeats on every flush, so logging each one would flood logs.
fn log_rejected_batch(error: &Error, event_count: usize) {
    let Error::Api { status, .. } = error else {
        // The API answered with success, so the events were most likely
        // accepted; resending them would duplicate them.
        if first_rejection_with_status(0) {
            error!(
                error = %error,
                event_count,
                "API response to sent events could not be decoded, not resending them (check api_host; further occurrences are logged at debug level)"
            );
        } else {
            debug!(error = %error, event_count, "API response to sent events could not be decoded");
        }
        return;
    };
    if first_rejection_with_status(*status) {
        let hint = match status {
            400 | 401 | 403 | 404 => {
                "check that the public key is correct and its tracking config is active; "
            }
            _ => "",
        };
        error!(
            error = %error,
            event_count,
            "API rejected events, dropping them ({hint}further rejections with this status are logged at debug level)"
        );
    } else {
        debug!(error = %error, event_count, "API rejected events, dropping them");
    }
}

fn first_rejection_with_status(status: u16) -> bool {
    let mut logged = LOGGED_REJECTIONS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if logged.contains(&status) {
        return false;
    }
    logged.push(status);
    true
}

/// Exponential backoff for automatic retries after a retryable failure. The
/// background timer and size-triggered flushes wait it out; explicit
/// `flush()` and `shutdown()` calls always try right away.
#[derive(Debug)]
struct RetryBackoff {
    base: Duration,
    state: std::sync::Mutex<BackoffState>,
}

#[derive(Debug, Default)]
struct BackoffState {
    failures: u32,
    resume_at: Option<Instant>,
}

impl RetryBackoff {
    fn new(base: Duration) -> Self {
        Self {
            base,
            state: std::sync::Mutex::new(BackoffState::default()),
        }
    }

    fn state(&self) -> std::sync::MutexGuard<'_, BackoffState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn is_waiting(&self) -> bool {
        self.state()
            .resume_at
            .is_some_and(|resume_at| Instant::now() < resume_at)
    }

    /// Records a failed attempt and returns how long automatic retries wait.
    fn record_failure(&self) -> Duration {
        let mut state = self.state();
        state.failures = state.failures.saturating_add(1);
        let delay = retry_delay(self.base, state.failures);
        state.resume_at = Some(Instant::now() + delay);
        delay
    }

    fn reset(&self) {
        *self.state() = BackoffState::default();
    }
}

/// The base interval doubled for each consecutive failure after the first,
/// capped at [`MAX_RETRY_BACKOFF`] (or the base, if that is longer).
fn retry_delay(base: Duration, failures: u32) -> Duration {
    let doublings = failures.saturating_sub(1).min(16);
    base.saturating_mul(1 << doublings)
        .min(MAX_RETRY_BACKOFF.max(base))
}

// ============================================
// SENDABLE WRAPPERS
// ============================================

trait BuildEvent {
    fn build(self) -> crate::types::TrackerEvent;
}

impl BuildEvent for TrackBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

impl BuildEvent for IdentifyBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

/// Sendable track event builder.
pub struct SendableTrack<'a> {
    builder: TrackBuilder,
    client: &'a Outlit,
}

impl<'a> SendableTrack<'a> {
    /// Add email (if identity was user_id or fingerprint).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.builder = self.builder.email(email);
        self
    }

    /// Add user_id (if identity was email or fingerprint).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.builder = self.builder.user_id(user_id);
        self
    }

    /// Add fingerprint (device identifier) to link this event to a device.
    pub fn fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.builder = self.builder.fingerprint(fingerprint);
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.property(key, value);
        self
    }

    /// Set custom timestamp.
    pub fn timestamp(mut self, ts: i64) -> Self {
        self.builder = self.builder.timestamp(ts);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

/// Sendable identify event builder.
pub struct SendableIdentify<'a> {
    builder: IdentifyBuilder,
    client: &'a Outlit,
}

impl<'a> SendableIdentify<'a> {
    /// Add email.
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.builder = self.builder.email(email);
        self
    }

    /// Add user_id.
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.builder = self.builder.user_id(user_id);
        self
    }

    /// Add fingerprint (device identifier) to link this device to the user.
    pub fn fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.builder = self.builder.fingerprint(fingerprint);
        self
    }

    /// Add a trait.
    pub fn trait_(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.trait_(key, value);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::email;
    use std::sync::mpsc;
    use std::time::Duration;
    use wiremock::matchers::method;
    use wiremock::{Mock, MockServer, ResponseTemplate};

    struct BlockingBuildEvent {
        builder: TrackBuilder,
        started: mpsc::Sender<()>,
        resume: mpsc::Receiver<()>,
    }

    impl BuildEvent for BlockingBuildEvent {
        fn build(self) -> TrackerEvent {
            self.started.send(()).unwrap();
            self.resume.recv().unwrap();
            self.builder.build()
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn shutdown_flushes_a_send_that_started_before_shutdown() {
        let mock_server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "success": true,
                "processed": 1
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = Arc::new(
            Outlit::builder("pk_test")
                .api_host(mock_server.uri())
                .flush_interval(Duration::from_secs(100))
                .build()
                .unwrap(),
        );
        let (started_tx, started_rx) = mpsc::channel();
        let (resume_tx, resume_rx) = mpsc::channel();

        let send_client = client.clone();
        let send = tokio::spawn(async move {
            send_client
                .enqueue_and_maybe_flush(BlockingBuildEvent {
                    builder: TrackBuilder::new("event", email("user@test.com")),
                    started: started_tx,
                    resume: resume_rx,
                })
                .await
        });
        started_rx.recv_timeout(Duration::from_secs(1)).unwrap();

        let shutdown_client = client.clone();
        let shutdown = tokio::spawn(async move { shutdown_client.shutdown().await });
        tokio::time::sleep(Duration::from_millis(20)).await;
        resume_tx.send(()).unwrap();

        send.await.unwrap().unwrap();
        shutdown.await.unwrap().unwrap();
        assert_eq!(client.pending_event_count().await, 0);
    }

    #[test]
    fn test_retry_delay_doubles_up_to_the_cap() {
        let base = Duration::from_secs(10);
        assert_eq!(retry_delay(base, 1), Duration::from_secs(10));
        assert_eq!(retry_delay(base, 2), Duration::from_secs(20));
        assert_eq!(retry_delay(base, 5), Duration::from_secs(160));
        assert_eq!(retry_delay(base, 6), MAX_RETRY_BACKOFF);
        assert_eq!(retry_delay(base, u32::MAX), MAX_RETRY_BACKOFF);
        // A flush interval above the cap is never shortened.
        let slow = Duration::from_secs(600);
        assert_eq!(retry_delay(slow, 3), slow);
    }

    #[tokio::test]
    async fn test_backoff_waits_after_a_failure_and_clears_on_reset() {
        let backoff = RetryBackoff::new(Duration::from_secs(60));
        assert!(!backoff.is_waiting());

        backoff.record_failure();
        assert!(backoff.is_waiting());
        assert_eq!(backoff.record_failure(), Duration::from_secs(120));

        backoff.reset();
        assert!(!backoff.is_waiting());
        assert_eq!(backoff.record_failure(), Duration::from_secs(60));
    }

    #[test]
    fn test_each_rejection_status_is_logged_at_error_level_once() {
        // 499 isn't used by any other test in this process.
        assert!(first_rejection_with_status(499));
        assert!(!first_rejection_with_status(499));
    }
}
