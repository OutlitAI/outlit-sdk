---
"@outlit/cli": major
"@outlit/tools": major
"@outlit/pi": major
---

Remove `integrations list`, `integrations capabilities`, and the generated
`outlit_get_integration_sync_status` tool. `outlit integrations setup` and
`outlit integrations status` are the supported CLI workflow. Add the generated
`outlit_setup_integration` contract and a bounded preferred setup client with secret-safe interactive
prompts, strict opt-in stdin configuration, safe browser handoffs, and old-Core compatibility.
Status now returns only the five canonical configuration-readiness states, without browser-session,
raw provider-state, sync, backfill, or action metadata.
