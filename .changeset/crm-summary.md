---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

`outlit_get_customer` can return `crmSummary` in its base response: each linked CRM and support tool account at a glance, with its stage and the custom picklists, numbers and yes/no fields that system holds, at most 8 per account. It is behind a per-workspace flag and absent when `include crm` is requested.
