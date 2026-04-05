---
"@outlit/browser": patch
"@outlit/core": patch
"@outlit/node": patch
---

Serialize browser batch customer attribution into top-level `customerIdentity` instead of nesting customer fields under `userIdentity`. This aligns the browser SDK with the platform ingest schema while keeping identify events customer-aware.
