---
"@outlit/tools": patch
---

Every public tool now declares `idempotentHint` as `true` or `false`, so MCP clients and app stores that require all four hints get an explicit value. `outlit_update_customer_access` is now `destructiveHint: true`: moving an Editor to Viewer removes edit rights.
