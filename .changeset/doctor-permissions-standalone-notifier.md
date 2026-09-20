---
"@outlit/cli": patch
---

Improve `outlit doctor` permission diagnostics and fix the standalone update notifier. Doctor now shows the organization and effective key grants from the existing validation response, lists command families unavailable to the key, and explains missing integrations access instead of making a guaranteed-denied request. The background update check on compiled binaries now respawns the real executable instead of relying on a possibly-missing bun runtime and a virtual `$bunfs` entrypoint, and asynchronous spawn failures no longer crash the foreground command.
