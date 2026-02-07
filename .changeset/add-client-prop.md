---
"@outlit/browser": minor
---

Add `client` prop to `OutlitProvider` for sharing a single Outlit instance between imperative usage and React context. When provided, the provider uses the existing instance directly and does not call `shutdown()` on unmount. Uses a discriminated union type to enforce mutual exclusivity with config props at compile time.
