---
"@outlit/node": patch
---

`flush()` and `shutdown()` now wait for a flush already in progress and then send what is still queued, instead of resolving immediately. Before, `await outlit.flush()` called while another flush was sending (for example the interval flush, or a batch-size flush) returned at once, so events tracked in that request could still be unsent when a serverless function ended. Retry behaviour is unchanged: a retryable failure puts its events back and throws, a non-retryable one drops them, and each call sends at most once. A call that waited on a flush that failed with a non-retryable error rethrows that error, since its events will not be sent. The batch-size and interval flushes still skip while a flush is in flight, so they never pile up behind a slow send.
