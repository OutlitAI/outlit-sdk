---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Update the `outlit_get_timeline` contract with the additive `unreadable`/`unreadableReason` output fields, present only when an event's underlying source record cannot be retrieved via `outlit_get_source` — models should not retry source lookups on those rows.
