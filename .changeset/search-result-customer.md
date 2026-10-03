---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts so each `outlit_search_customer_context` result can name its customer: `source` and `fact` results carry an optional `customer` (`id`, `name`, `domain`), which is `null` when the result can't be attributed to exactly one customer the caller can read. A search across customers now says whose source or fact matched. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `customer` like `null`. The API reference and CLI docs show the field. Companion to OutlitAI/Core#2569.
