---
"@outlit/cli": major
"@outlit/tools": major
---

Remove `integrations list`, `integrations capabilities`, and the generated
`outlit_get_integration_sync_status` tool. `outlit integrations setup` and
`outlit integrations status` are the supported integration workflow; status returns only canonical
readiness and last observed data time, without browser-session, raw provider-state, sync, or action
metadata.
