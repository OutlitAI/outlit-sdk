---
"@outlit/browser": patch
---

Fix race condition where stage events (activate, engaged, inactive) were silently dropped when called before user identity was established. Events are now queued and flushed when setUser() or identify() is called.
