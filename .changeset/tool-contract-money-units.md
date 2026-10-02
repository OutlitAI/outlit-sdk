---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts with the unit on money fields: `currentMrr` and `lifetimeRevenue` (list and get customer) and `accountImportance.arrCents` (attention) are in the smallest unit of the billing currency, so divide by 100 for two-decimal currencies such as USD, use the value as is for zero-decimal currencies such as JPY, and divide by 1000 for three-decimal currencies such as KWD. ARR is 12 × `currentMrr`, in the same units. Descriptions only; no field shapes change. Companion to OutlitAI/Core#2557.
