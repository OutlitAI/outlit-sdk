---
"@outlit/tools": minor
"@outlit/pi": patch
"@outlit/cli": minor
---

Regenerate the Agent API contracts for customer context sections. Customer reads add billing, support and identity context; billing output renames the customer-level live subscription rollup to `subscriptionMrr`. The no-DDL variant does not add SQL customer columns or a weekly-metrics SQL view.
