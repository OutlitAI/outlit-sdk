//! Outlit client implementation.

use crate::builders::{IdentifyBuilder, TrackBuilder};
use crate::config::{Config, OutlitBuilder};
use crate::queue::EventQueue;
use crate::transport::HttpTransport;
use crate::types::{IngestPayload, SourceType, TrackerEvent};
use crate::{Email, Error, Fingerprint, UserId};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::interval;
use tracing::{debug, error, info, instrument};

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

        let client = Self {
            config,
            queue,
            transport,
            is_shutdown: Arc::new(AtomicBool::new(false)),
            lifecycle_lock: Mutex::new(()),
            shutdown_lock: Mutex::new(()),
            flush_lock: Arc::new(Mutex::new(())),
            flush_handle: Mutex::new(None),
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
    /// Important: Call this before your application exits!
    #[instrument(skip(self))]
    pub async fn flush(&self) -> Result<(), Error> {
        let _flush_guard = self.flush_lock.lock().await;
        flush_queued_events(
            &self.queue,
            &self.transport,
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

                let _ = flush_queued_events(&queue, &transport, queue.max_size(), true).await;
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
            self.flush().await?;
        }

        Ok(())
    }
}

async fn flush_queued_events(
    queue: &EventQueue,
    transport: &HttpTransport,
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

    if let Err((error, unsent_events)) =
        send_events_in_batches(transport, events, max_batch_size).await
    {
        if periodic {
            error!(error = %error, "periodic flush failed, requeuing events");
        } else {
            error!(error = %error, "flush failed, requeuing events");
        }
        queue.requeue(unsent_events).await;
        return Err(error);
    }

    Ok(())
}

async fn send_events_in_batches(
    transport: &HttpTransport,
    mut events: Vec<TrackerEvent>,
    max_batch_size: usize,
) -> Result<(), (Error, Vec<TrackerEvent>)> {
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
            let mut unsent_events = payload.events;
            unsent_events.extend(remaining);
            return Err((error, unsent_events));
        }

        events = remaining;
    }

    Ok(())
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
}
