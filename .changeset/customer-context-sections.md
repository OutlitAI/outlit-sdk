---
"@outlit/tools": minor
"@outlit/pi": patch
"@outlit/cli": minor
---

Regenerate the Agent API contracts for customer context sections. Customer reads add billing, support and identity context; billing output renames the customer-level live subscription rollup to `subscriptionMrr`. The no-DDL variant does not add SQL customer columns or a weekly-metrics SQL view. The CLI also syncs its embedded Outlit skill text from the current no-usage upstream skill; this skill-text refresh is patch-level for `@outlit/cli` and is included in the package's minor customer-context release.
