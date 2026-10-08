---
"@outlit/browser": patch
---

The visitor ID and consent cookies are now marked `Secure` on HTTPS pages, so browsers never send them over plain HTTP. Plain-HTTP pages, such as local development, keep setting them without `Secure`.
