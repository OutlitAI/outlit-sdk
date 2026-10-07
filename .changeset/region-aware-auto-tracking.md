---
"@outlit/browser": minor
"@outlit/core": minor
---

`@outlit/browser` gains a region-aware `"auto"` tracking mode and uses it by default. Because the region check is asynchronous, `getVisitorId()` now returns `null` until auto mode resolves and tracking is enabled (previously it was populated synchronously on init). `autoTrack` now accepts `boolean | "auto"`: in `"auto"` mode the SDK asks the Outlit edge bootstrap endpoint (`GET {apiHost}/api/i/v1/{publicKey}/bootstrap`) whether the visitor's region requires opt-in consent and only enables tracking when it doesn't. In consent-required regions (EEA, UK, Switzerland — the policy list lives server-side) and on any failure (network error, timeout, non-2xx, malformed response) it fails closed and behaves like `autoTrack: false`: no visitor ID, cookie, or localStorage key is written until `enableTracking()` is called. `autoTrack: true` restores immediate always-on tracking. `track()`/`identify()` calls made while the region check is pending are buffered in memory (bounded at 100) and replayed on enable or discarded on a consent-required verdict.

Consent storage now distinguishes explicit opt-in from legacy auto-written opt-in: a public `enableTracking()` call persists `"2"` (explicit), while automatic enables persist nothing. Older SDKs wrote `"1"` on every auto-enable without a real decision, so in `"auto"` mode a persisted `"1"` is treated as "no decision" and triggers the region check; it still counts as opted-in under `autoTrack: true`/`false` for backward compatibility. `"0"` remains opt-out everywhere.

React `OutlitProvider` and the Vue plugin now subscribe to a new `Outlit.onTrackingStateChange()` listener (returns an unsubscribe function) so `isTrackingEnabled` updates when auto mode resolves asynchronously, and no longer force `autoTrack: true` by default. `data-auto-track` on the script tag accepts `"true"`/`"false"`/`"auto"`; absent means `"auto"`.

`@outlit/core` adds `buildBootstrapUrl(apiHost, publicKey)` and the `BootstrapResponse` type.
