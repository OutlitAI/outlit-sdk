---
"@outlit/node": patch
---

Prevent infinite flush retry loops on non-retryable ingest errors.

`@outlit/node` now classifies transport failures and only retries transient errors
(network/timeouts, `429`, and `5xx`). Non-retryable API errors such as invalid or
inactive tracking configuration (`400`) no longer get re-queued forever, and periodic
auto-flush retries are disabled after the first fatal non-retryable failure.
