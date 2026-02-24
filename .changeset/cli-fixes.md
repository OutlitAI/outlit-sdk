---
"@outlit/cli": patch
---

Fix credential leak in MCP setup (suppress subprocess output that included Authorization header), use outputError for pagination failures, and improve test isolation.
