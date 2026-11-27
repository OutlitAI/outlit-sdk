---
"@outlit/tools": minor
"@outlit/pi": patch
"@outlit/cli": minor
---

Regenerate the Agent API contracts for customer context sections. Customer reads add billing, support, identity and weekly usage context; billing output renames the customer-level live subscription rollup to `subscriptionMrr`. The `customers` SQL view documented through `outlit_get_schema` gains `owner` and `subscription_mrr_*`, and SQL analytics adds `customer_metrics_weekly`. The CLI also syncs its embedded Outlit skill text from the current no-usage upstream skill; this skill-text refresh is patch-level for `@outlit/cli` and is included in the package's minor customer-context release.
