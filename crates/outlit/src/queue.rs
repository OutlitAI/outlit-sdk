//! Event queue with batching.

use crate::types::TrackerEvent;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Event queue that batches events for sending.
#[derive(Debug)]
pub struct EventQueue {
    events: Arc<Mutex<Vec<TrackerEvent>>>,
    max_size: usize,
}

impl EventQueue {
    /// Create a new event queue.
    pub fn new(max_size: usize) -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            max_size,
        }
    }

    /// Add an event to the queue.
    pub async fn enqueue(&self, event: TrackerEvent) {
        let mut events = self.events.lock().await;
        events.push(event);
    }

    /// Check if the queue should be flushed.
    pub async fn should_flush(&self) -> bool {
        let events = self.events.lock().await;
        events.len() >= self.max_size
    }

    /// Get the number of events in the queue.
    pub async fn len(&self) -> usize {
        let events = self.events.lock().await;
        events.len()
    }

    /// Check if the queue is empty.
    pub async fn is_empty(&self) -> bool {
        self.len().await == 0
    }

    /// Drain all events from the queue.
    pub async fn drain(&self) -> Vec<TrackerEvent> {
        let mut events = self.events.lock().await;
        std::mem::take(&mut *events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CustomEventData, TrackerEvent};
    use serde_json::json;
    use std::collections::HashMap;

    fn make_test_event(id: i32) -> TrackerEvent {
        TrackerEvent::Custom(CustomEventData {
            timestamp: 1706400000000,
            url: format!("server://test{}", id),
            path: "/".into(),
            event_name: format!("event_{}", id),
            properties: Some(HashMap::from([("id".into(), json!(id))])),
        })
    }

    #[tokio::test]
    async fn test_enqueue_and_len() {
        let queue = EventQueue::new(10);

        assert_eq!(queue.len().await, 0);
        assert!(queue.is_empty().await);

        queue.enqueue(make_test_event(1)).await;
        assert_eq!(queue.len().await, 1);
        assert!(!queue.is_empty().await);

        queue.enqueue(make_test_event(2)).await;
        assert_eq!(queue.len().await, 2);
    }

    #[tokio::test]
    async fn test_should_flush_at_max_size() {
        let queue = EventQueue::new(3);

        queue.enqueue(make_test_event(1)).await;
        queue.enqueue(make_test_event(2)).await;
        assert!(!queue.should_flush().await);

        queue.enqueue(make_test_event(3)).await;
        assert!(queue.should_flush().await);
    }

    #[tokio::test]
    async fn test_drain() {
        let queue = EventQueue::new(10);

        queue.enqueue(make_test_event(1)).await;
        queue.enqueue(make_test_event(2)).await;
        queue.enqueue(make_test_event(3)).await;

        let events = queue.drain().await;
        assert_eq!(events.len(), 3);
        assert!(queue.is_empty().await);
    }

    #[tokio::test]
    async fn test_concurrent_enqueue() {
        let queue = Arc::new(EventQueue::new(1000));
        let mut handles = vec![];

        for i in 0..100 {
            let q = queue.clone();
            handles.push(tokio::spawn(async move {
                q.enqueue(make_test_event(i)).await;
            }));
        }

        for handle in handles {
            handle.await.unwrap();
        }

        assert_eq!(queue.len().await, 100);
    }
}
