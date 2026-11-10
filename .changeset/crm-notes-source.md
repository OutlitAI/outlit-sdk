---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

`outlit_get_source`, `outlit_list_sources` and `outlit_search_customer_context` accept the `CRM_NOTE` source type: the notes reps log in the CRM (HubSpot first). `outlit_list_sources` lists them only for a customer and only when `sourceType` is `CRM_NOTE`. It is behind a per-workspace flag.
