---
"@outlit/browser": patch
---

Clean up exit event listeners (visibilitychange, pagehide, beforeunload) on shutdown to prevent leaks during HMR and instance recreation. Adds dev-mode warning for duplicate instances with the same public key.
