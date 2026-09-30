---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts for Core #2471. `outlit_list_attention_items` and `outlit_get_attention_item` (commandVersion 1 → 2) return renewal Attention items as well as churn cases: each item adds `responsibility` (`"churn"` | `"renewal"`) and `renewal` (`{ cycleId, renewalDate, daysRemaining, overdue, readiness, outcome }` or `null`), and list items add `approachStatus` (`"none"` | `"review"` | `"active"` | `"complete"`); `outlit_get_attention_item` accepts a renewal ID. `outlit_list_renewals` adds an optional `attention` filter (`"open"` | `"resolved"` | `"none"`).
