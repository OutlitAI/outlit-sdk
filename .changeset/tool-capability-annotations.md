---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts with `annotations.readOnlyHint`/`annotations.destructiveHint` on every public tool. Read-only commands declare `readOnlyHint: true`; merge/archive/revoke-style commands declare `destructiveHint: true`. Companion to OutlitAI/Core#2341.
