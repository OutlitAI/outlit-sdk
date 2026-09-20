---
"@outlit/tools": patch
"@outlit/pi": patch
---

Recognize Core's non-retryable `TOOL_RESOURCE_NOT_FOUND` response for missing or unavailable resources, preserving its structured error details for CLI and SDK callers.
