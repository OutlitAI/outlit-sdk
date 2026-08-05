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
        if self.queue.is_empty().await {
            return Ok(());
        }

        let events = self.queue.drain().await;
        if events.is_empty() {
            return Ok(());
        }

        info!(event_count = events.len(), "flushing events");

        if let Err((e, unsent_events)) =
            send_events_in_batches(&self.transport, events, self.config.max_batch_size()).await
        {
            // Requeue the failed batch and every later batch to prevent data loss.
            error!(error = %e, "flush failed, requeuing events");
            self.queue.requeue(unsent_events).await;
            return Err(e);
        }

        Ok(())
    }

    /// Shutdown the client gracefully.
    ///
    /// Flushes remaining events and stops the background flush timer.
    #[instrument(skip(self))]
    pub async fn shutdown(&self) -> Result<(), Error> {
        if self.is_shutdown.swap(true, Ordering::SeqCst) {
            return Ok(()); // Already shutdown
        }

        info!("shutting down client");

        // Stop flush timer
        if let Some(handle) = self.flush_handle.lock().await.take() {
            handle.abort();
        }

        // Final flush
        self.flush().await?;

        Ok(())
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

        let handle = tokio::spawn(async move {
            let mut timer = interval(flush_interval);

            loop {
                timer.tick().await;

                // Check if shutdown
                if is_shutdown.load(Ordering::SeqCst) {
                    break;
                }

                if queue.is_empty().await {
                    continue;
                }

                let events = queue.drain().await;
                if events.is_empty() {
                    continue;
                }

                debug!(event_count = events.len(), "periodic flush");

                if let Err((e, unsent_events)) =
                    send_events_in_batches(&transport, events, queue.max_size()).await
                {
                    error!(error = %e, "periodic flush failed, requeuing events");
                    queue.requeue(unsent_events).await;
                }
            }
        });

        // Store handle but don't block on it
        let flush_handle = self.flush_handle.try_lock();
        if let Ok(mut guard) = flush_handle {
            *guard = Some(handle);
        }
    }

    async fn enqueue_and_maybe_flush(&self, builder: impl BuildEvent) -> Result<(), Error> {
        self.ensure_not_shutdown()?;

        let event = builder.build();
        self.queue.enqueue(event).await;

        if self.queue.should_flush().await {
            self.flush().await?;
        }

        Ok(())
    }
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
