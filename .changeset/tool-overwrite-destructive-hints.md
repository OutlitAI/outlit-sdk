---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

`outlit_assign_customer_owner`, `outlit_create_destination`, `outlit_update_destination`, `outlit_enable_destination`, `outlit_disable_destination`, `outlit_update_customer_activation`, `outlit_update_workspace_settings`, `outlit_setup_integration`, `outlit_act_on_inbox_item` and `outlit_undo_inbox_action` are now `destructiveHint: true`, since each can overwrite an existing value (the owner, a destination's settings or enabled state, the activation event, workspace defaults, an integration's credentials and configuration, or an Inbox task's state). Clients that act on MCP annotations can use this to ask before running them, depending on their own policy.
