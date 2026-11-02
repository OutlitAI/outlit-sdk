---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts so a `COMMITMENT` fact from `outlit_list_facts`, `outlit_get_fact` and the fact hits of `outlit_search_customer_context` can say who owes it: an optional `owedBy` of `"us"` (the organization's own team), `"customer"`, or `null` when it isn't known. Other facts omit it. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `owedBy` as unknown. The CLI docs mention the field. Companion to OutlitAI/Core#3612.
