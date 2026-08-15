---
"@outlit/cli": patch
"@outlit/tools": patch
---

Add read-only Attention list and detail contracts plus `outlit attention list` and
`outlit attention get <id>`. Attention exposes bounded, authorized customer-risk detail with
Core-owned finite nonnegative ARR values and no email draft content or internal
agent state. V1 list filtering is limited to lifecycle and customer; each row
still reports its current priority.
