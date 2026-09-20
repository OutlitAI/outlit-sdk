---
"@outlit/cli": patch
---

Improve `outlit doctor` permission diagnostics and fix the standalone update notifier. Doctor now shows the organization and effective key grants from the existing validation response, lists commands unavailable to the key with per-operation read/manage precision (for example, a read-only key can still list identity suggestions and preview merges while reject and execute remain unavailable), and explains missing integrations access instead of making a guaranteed-denied request. The background update check on compiled binaries now respawns the real executable instead of relying on a possibly-missing bun runtime and a virtual `$bunfs` entrypoint, asynchronous spawn failures no longer crash the foreground command, and update notices share the standalone manual-update guidance instead of prescribing package-manager commands the binary cannot use.
