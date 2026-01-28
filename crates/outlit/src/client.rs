//! Outlit client implementation.

use crate::builders::{BillingBuilder, IdentifyBuilder, StageBuilder, TrackBuilder};
use crate::config::{Config, OutlitBuilder};
use crate::queue::EventQueue;
use crate::transport::HttpTransport;
use crate::types::{BillingStatus, IngestPayload, JourneyStage, SourceType};
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
    // USER STAGES
    // ============================================

    /// User journey stage methods.
    pub fn user(&self) -> UserMethods<'_> {
        UserMethods { client: self }
    }

    // ============================================
    // CUSTOMER BILLING
    // ============================================

    /// Customer billing methods.
    pub fn customer(&self) -> CustomerMethods<'_> {
        CustomerMethods { client: self }
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

        let payload = IngestPayload {
            source: SourceType::Server,
            events,
        };

        if let Err(e) = self.transport.send(&payload).await {
            // Requeue events on failure to prevent data loss
            error!(error = %e, "flush failed, requeuing events");
            self.queue.requeue(payload.events).await;
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

                let payload = IngestPayload {
                    source: SourceType::Server,
                    events,
                };

                if let Err(e) = transport.send(&payload).await {
                    error!(error = %e, "periodic flush failed, requeuing events");
                    queue.requeue(payload.events).await;
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

impl BuildEvent for StageBuilder {
    fn build(self) -> crate::types::TrackerEvent {
        self.build()
    }
}

impl BuildEvent for BillingBuilder {
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

/// Sendable stage event builder.
pub struct SendableStage<'a> {
    builder: StageBuilder,
    client: &'a Outlit,
}

impl<'a> SendableStage<'a> {
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

    /// Add fingerprint (device identifier).
    pub fn fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.builder = self.builder.fingerprint(fingerprint);
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.property(key, value);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

/// Sendable billing event builder.
pub struct SendableBilling<'a> {
    builder: BillingBuilder,
    client: &'a Outlit,
}

impl<'a> SendableBilling<'a> {
    /// Set customer ID.
    pub fn customer_id(mut self, id: impl Into<String>) -> Self {
        self.builder = self.builder.customer_id(id);
        self
    }

    /// Set Stripe customer ID.
    pub fn stripe_customer_id(mut self, id: impl Into<String>) -> Self {
        self.builder = self.builder.stripe_customer_id(id);
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.builder = self.builder.property(key, value);
        self
    }

    /// Send the event.
    pub async fn send(self) -> Result<(), Error> {
        self.client.enqueue_and_maybe_flush(self.builder).await
    }
}

// ============================================
// NAMESPACE METHODS
// ============================================

/// User journey stage methods.
pub struct UserMethods<'a> {
    client: &'a Outlit,
}

impl<'a> UserMethods<'a> {
    /// Mark user as activated.
    pub fn activate(&self, identity: impl Into<Email>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Activated, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as activated by user_id.
    pub fn activate_by_user_id(&self, identity: impl Into<UserId>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Activated, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as activated by fingerprint.
    pub fn activate_by_fingerprint(&self, identity: impl Into<Fingerprint>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Activated, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as engaged.
    pub fn engaged(&self, identity: impl Into<Email>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Engaged, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as engaged by user_id.
    pub fn engaged_by_user_id(&self, identity: impl Into<UserId>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Engaged, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as engaged by fingerprint.
    pub fn engaged_by_fingerprint(&self, identity: impl Into<Fingerprint>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Engaged, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as inactive.
    pub fn inactive(&self, identity: impl Into<Email>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Inactive, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as inactive by user_id.
    pub fn inactive_by_user_id(&self, identity: impl Into<UserId>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Inactive, identity.into()),
            client: self.client,
        }
    }

    /// Mark user as inactive by fingerprint.
    pub fn inactive_by_fingerprint(&self, identity: impl Into<Fingerprint>) -> SendableStage<'a> {
        SendableStage {
            builder: StageBuilder::new(JourneyStage::Inactive, identity.into()),
            client: self.client,
        }
    }
}

/// Customer billing methods.
pub struct CustomerMethods<'a> {
    client: &'a Outlit,
}

impl<'a> CustomerMethods<'a> {
    /// Mark customer as trialing.
    pub fn trialing(&self, domain: impl Into<String>) -> SendableBilling<'a> {
        SendableBilling {
            builder: BillingBuilder::new(BillingStatus::Trialing, domain),
            client: self.client,
        }
    }

    /// Mark customer as paid.
    pub fn paid(&self, domain: impl Into<String>) -> SendableBilling<'a> {
        SendableBilling {
            builder: BillingBuilder::new(BillingStatus::Paid, domain),
            client: self.client,
        }
    }

    /// Mark customer as churned.
    pub fn churned(&self, domain: impl Into<String>) -> SendableBilling<'a> {
        SendableBilling {
            builder: BillingBuilder::new(BillingStatus::Churned, domain),
            client: self.client,
        }
    }
}
