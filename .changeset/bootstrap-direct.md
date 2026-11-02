---
"@outlit/browser": patch
---

Keep the `autoTrack: "auto"` region check on Outlit's own host even when `apiHost` points at a proxy, so a consent decision always reflects the visitor's location rather than the proxy server's. If the check is blocked, tracking still waits for `enableTracking()`.
