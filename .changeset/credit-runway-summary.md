---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Add `rateBasis`, `paceSinceReset`, `periodStart` and `changeDays` to the customer credit summary contract; the forecast rate is now a trailing 28-day average (7-day floor) with since-reset pace as context only.
