---
"@outlit/tools": patch
---

Every public tool now declares `idempotentHint` as `true` or `false`, so MCP clients and app stores that require all four hints get an explicit value. `outlit_update_customer_access` and `outlit_grant_customer_access` are now `destructiveHint: true`, since either can move an Editor to Viewer and remove edit rights. `outlit_assign_customer_owner` is `idempotentHint: false`, since every call restamps the assignment time.
