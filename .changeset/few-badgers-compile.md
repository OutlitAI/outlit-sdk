---
"@outlit/cli": patch
---

Fix the native CLI binary release by building local tool dependencies before release tests and avoiding top-level await in the CLI entrypoint.
