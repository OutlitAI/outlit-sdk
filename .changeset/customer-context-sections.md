---
"@outlit/tools": minor
"@outlit/pi": patch
"@outlit/cli": minor
---

Regenerate the Agent API contracts for customer context sections. Customer reads add billing, support, usage and identity context; billing output renames the customer-level live subscription rollup to `subscriptionMrr`; and the SQL customers schema exposes owner plus subscription-MRR columns beside the deprecated legacy MRR fields.
