---
"@outlit/tools": minor
"@outlit/pi": patch
"@outlit/cli": minor
---

Regenerate the Agent API contracts for customer context sections. Customer reads add billing, support, usage and identity context; billing output renames the customer-level live subscription rollup to `subscriptionMrr`. In Core's customers SQL view, documented through `outlit_get_schema`, the view gains `owner` and the `subscription_mrr_*` columns; legacy `mrr_cents` and `mrr_status` remain deprecated.
