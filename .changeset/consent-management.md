---
"@outlit/browser": minor
---

Add `disableTracking()` method and consent state persistence

- `disableTracking()` programmatically stops all tracking, flushes pending events, and persists the opt-out decision
- Consent decisions (opt-in/opt-out) are persisted across sessions via localStorage and cookies
- On page load, persisted consent takes priority over the `autoTrack` option
- `disableTracking` exposed via React `useOutlit()` hook and Vue `useOutlit()` composable
- CDN snippet updated to support `disableTracking` queuing before SDK loads
