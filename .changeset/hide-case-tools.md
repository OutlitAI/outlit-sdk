---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
---

The churn case tools are hidden from external callers. This ships in the same Agent API v2 release as the work tools (`work-identity-tools-v2`), so there is one major bump. The work toolset is your tasks (Inbox), and acting on them, with undo.

- `outlit_list_cases` and `outlit_get_case` are gone from `@outlit/tools`, the default and Pi toolsets and the generated contracts, and so are their retired names `outlit_list_attention_items` and `outlit_get_attention_item`. The gateway refuses all four with 403 `TOOL_CALL_FORBIDDEN`.
- The `AttentionListResult`, `AttentionItemSummary`, `AttentionItemResult` and `AttentionItem` types are removed from `@outlit/tools`.
- The CLI has no `outlit attention` commands: `attention list` and `attention get` are removed, along with their shell completions.
- Tasks no longer carry `partOf.case`. `outlit_list_tasks` items keep `partOf.work`, `partOf.title` and `partOf.renewalId`.
