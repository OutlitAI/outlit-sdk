---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

`outlit_assign_customer_owner`, `outlit_update_destination`, `outlit_update_customer_activation`, `outlit_update_workspace_settings` and `outlit_setup_integration` are now `destructiveHint: true`, since each overwrites an existing value (the owner, a destination's settings, the activation event, workspace defaults, or an integration's credentials and configuration). Clients that honor MCP annotations will ask before running them.
