---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts with the unit on money fields: `currentMrr` and `lifetimeRevenue` (list and get customer) and `accountImportance.arrCents` (attention) are in the billing provider's units for the currency they were billed in. For USD, EUR, GBP and CAD these are cents, so divide by 100; other currencies follow the provider's amount rules, so the descriptions don't assume a divisor for them. ARR is 12 × `currentMrr` in the same units. Descriptions only; no field shapes change. Companion to OutlitAI/Core#2557.
