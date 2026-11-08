---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

`outlit_list_customers` rows can carry `crmSummary`: the customer's CRM and support tool accounts at a glance, by field label (the stage and the first custom picklists, numbers and yes/no fields, at most 4 per account from 3 accounts). It is behind a per-workspace flag and absent when `crmFields` is given.
