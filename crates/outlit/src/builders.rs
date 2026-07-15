//! Event builders for fluent API.

use crate::types::{CustomEventData, IdentifyEventData, TrackerEvent};
use crate::{Email, Fingerprint, UserId};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Get current timestamp in milliseconds.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Build a server URL from identity.
fn server_url(email: Option<&str>, user_id: Option<&str>, fingerprint: Option<&str>) -> String {
    let id = email.or(user_id).or(fingerprint).unwrap_or("unknown");
    format!("server://{}", id)
}

/// Identity for events.
#[derive(Debug, Clone)]
pub enum Identity {
    Email(Email),
    UserId(UserId),
    Fingerprint(Fingerprint),
}

impl Identity {
    fn email(&self) -> Option<&str> {
        match self {
            Identity::Email(e) => Some(e.as_str()),
            _ => None,
        }
    }

    fn user_id(&self) -> Option<&str> {
        match self {
            Identity::UserId(id) => Some(id.as_str()),
            _ => None,
        }
    }

    fn fingerprint(&self) -> Option<&str> {
        match self {
            Identity::Fingerprint(fp) => Some(fp.as_str()),
            _ => None,
        }
    }
}

impl From<Email> for Identity {
    fn from(e: Email) -> Self {
        Identity::Email(e)
    }
}

impl From<UserId> for Identity {
    fn from(id: UserId) -> Self {
        Identity::UserId(id)
    }
}

impl From<Fingerprint> for Identity {
    fn from(fp: Fingerprint) -> Self {
        Identity::Fingerprint(fp)
    }
}

// ============================================
// TRACK BUILDER
// ============================================

/// Builder for track events.
#[derive(Debug)]
pub struct TrackBuilder {
    event_name: String,
    identity: Identity,
    additional_email: Option<String>,
    additional_user_id: Option<String>,
    additional_fingerprint: Option<String>,
    properties: HashMap<String, Value>,
    timestamp: Option<i64>,
}

impl TrackBuilder {
    pub(crate) fn new(event_name: impl Into<String>, identity: impl Into<Identity>) -> Self {
        Self {
            event_name: event_name.into(),
            identity: identity.into(),
            additional_email: None,
            additional_user_id: None,
            additional_fingerprint: None,
            properties: HashMap::new(),
            timestamp: None,
        }
    }

    /// Add email (if identity was user_id or fingerprint).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.additional_email = Some(email.into());
        self
    }

    /// Add user_id (if identity was email or fingerprint).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.additional_user_id = Some(user_id.into());
        self
    }

    /// Add fingerprint (device identifier) to link this event to a device.
    pub fn fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.additional_fingerprint = Some(fingerprint.into());
        self
    }

    /// Add a property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.properties.insert(key.into(), value.into());
        self
    }

    /// Set custom timestamp (milliseconds since epoch).
    pub fn timestamp(mut self, ts: i64) -> Self {
        self.timestamp = Some(ts);
        self
    }

    /// Build the event.
    pub(crate) fn build(self) -> TrackerEvent {
        let email = self
            .identity
            .email()
            .map(String::from)
            .or(self.additional_email);
        let user_id = self
            .identity
            .user_id()
            .map(String::from)
            .or(self.additional_user_id);
        let fingerprint = self
            .identity
            .fingerprint()
            .map(String::from)
            .or(self.additional_fingerprint);

        let mut properties = self.properties;
        // Include identity in properties for server-side resolution
        properties.insert("__email".into(), json!(email));
        properties.insert("__userId".into(), json!(user_id));
        properties.insert("__fingerprint".into(), json!(fingerprint));

        TrackerEvent::Custom(CustomEventData {
            timestamp: self.timestamp.unwrap_or_else(now_ms),
            url: server_url(email.as_deref(), user_id.as_deref(), fingerprint.as_deref()),
            path: "/".into(),
            event_name: self.event_name,
            properties: Some(properties),
        })
    }
}

// ============================================
// IDENTIFY BUILDER
// ============================================

/// Builder for identify events.
#[derive(Debug)]
pub struct IdentifyBuilder {
    identity: Identity,
    additional_email: Option<String>,
    additional_user_id: Option<String>,
    additional_fingerprint: Option<String>,
    traits: HashMap<String, Value>,
}

impl IdentifyBuilder {
    pub(crate) fn new(identity: impl Into<Identity>) -> Self {
        Self {
            identity: identity.into(),
            additional_email: None,
            additional_user_id: None,
            additional_fingerprint: None,
            traits: HashMap::new(),
        }
    }

    /// Add email (if identity was user_id or fingerprint).
    pub fn email(mut self, email: impl Into<String>) -> Self {
        self.additional_email = Some(email.into());
        self
    }

    /// Add user_id (if identity was email or fingerprint).
    pub fn user_id(mut self, user_id: impl Into<String>) -> Self {
        self.additional_user_id = Some(user_id.into());
        self
    }

    /// Add fingerprint (device identifier) to link this device to the user.
    pub fn fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.additional_fingerprint = Some(fingerprint.into());
        self
    }

    /// Add a trait (using trait_ because trait is reserved).
    pub fn trait_(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.traits.insert(key.into(), value.into());
        self
    }

    /// Build the event.
    pub(crate) fn build(self) -> TrackerEvent {
        let email = self
            .identity
            .email()
            .map(String::from)
            .or(self.additional_email);
        let user_id = self
            .identity
            .user_id()
            .map(String::from)
            .or(self.additional_user_id);
        let fingerprint = self
            .identity
            .fingerprint()
            .map(String::from)
            .or(self.additional_fingerprint);

        TrackerEvent::Identify(IdentifyEventData {
            timestamp: now_ms(),
            url: server_url(email.as_deref(), user_id.as_deref(), fingerprint.as_deref()),
            path: "/".into(),
            email,
            user_id,
            fingerprint,
            traits: if self.traits.is_empty() {
                None
            } else {
                Some(self.traits)
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{email, fingerprint, user_id};

    #[test]
    fn test_track_builder_with_email() {
        let event = TrackBuilder::new("signup", email("user@example.com"))
            .property("plan", "pro")
            .build();

        if let TrackerEvent::Custom(data) = event {
            assert_eq!(data.event_name, "signup");
            assert!(data.url.contains("user@example.com"));
            let props = data.properties.unwrap();
            assert_eq!(props.get("plan").unwrap(), "pro");
            assert_eq!(props.get("__email").unwrap(), "user@example.com");
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_track_builder_with_user_id() {
        let event = TrackBuilder::new("signup", user_id("usr_123"))
            .email("user@example.com") // add email too
            .build();

        if let TrackerEvent::Custom(data) = event {
            let props = data.properties.unwrap();
            assert_eq!(props.get("__userId").unwrap(), "usr_123");
            assert_eq!(props.get("__email").unwrap(), "user@example.com");
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_track_builder_with_fingerprint_identity() {
        let event = TrackBuilder::new("page_view", fingerprint("device_abc123"))
            .property("page", "/pricing")
            .build();

        if let TrackerEvent::Custom(data) = event {
            assert_eq!(data.event_name, "page_view");
            assert!(data.url.contains("device_abc123"));
            let props = data.properties.unwrap();
            assert_eq!(props.get("page").unwrap(), "/pricing");
            assert_eq!(props.get("__fingerprint").unwrap(), "device_abc123");
            assert_eq!(props.get("__email").unwrap(), &serde_json::Value::Null);
            assert_eq!(props.get("__userId").unwrap(), &serde_json::Value::Null);
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_track_builder_fingerprint_with_email() {
        let event = TrackBuilder::new("signup", email("user@example.com"))
            .fingerprint("device_abc123")
            .build();

        if let TrackerEvent::Custom(data) = event {
            let props = data.properties.unwrap();
            assert_eq!(props.get("__email").unwrap(), "user@example.com");
            assert_eq!(props.get("__fingerprint").unwrap(), "device_abc123");
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_track_builder_fingerprint_with_user_id() {
        let event = TrackBuilder::new("feature_used", fingerprint("device_abc123"))
            .user_id("usr_123")
            .build();

        if let TrackerEvent::Custom(data) = event {
            let props = data.properties.unwrap();
            assert_eq!(props.get("__fingerprint").unwrap(), "device_abc123");
            assert_eq!(props.get("__userId").unwrap(), "usr_123");
        } else {
            panic!("Expected custom event");
        }
    }

    #[test]
    fn test_identify_builder() {
        let event = IdentifyBuilder::new(email("user@example.com"))
            .user_id("usr_123")
            .trait_("name", "John")
            .trait_("plan", "pro")
            .build();

        if let TrackerEvent::Identify(data) = event {
            assert_eq!(data.email, Some("user@example.com".into()));
            assert_eq!(data.user_id, Some("usr_123".into()));
            let traits = data.traits.unwrap();
            assert_eq!(traits.get("name").unwrap(), "John");
        } else {
            panic!("Expected identify event");
        }
    }

    #[test]
    fn test_identify_builder_with_fingerprint() {
        let event = IdentifyBuilder::new(email("user@example.com"))
            .fingerprint("device_abc123")
            .user_id("usr_123")
            .build();

        if let TrackerEvent::Identify(data) = event {
            assert_eq!(data.email, Some("user@example.com".into()));
            assert_eq!(data.fingerprint, Some("device_abc123".into()));
            assert_eq!(data.user_id, Some("usr_123".into()));
        } else {
            panic!("Expected identify event");
        }
    }
}
