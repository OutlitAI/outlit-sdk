---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

`outlit_create_destination` is `destructiveHint: true` again: with `isDefault: true` it replaces the workspace's current default destination. Clients that act on MCP annotations can use this to ask before running it, depending on their own policy.
