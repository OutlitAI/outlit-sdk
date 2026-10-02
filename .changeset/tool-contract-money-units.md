---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts with the unit on money fields: `currentMrr` and `lifetimeRevenue` (list and get customer) and `accountImportance.arrCents` (attention) are in the currency's minor units (cents), and ARR is 12 × `currentMrr`. Descriptions only; no field shapes change. Companion to OutlitAI/Core#2557.
