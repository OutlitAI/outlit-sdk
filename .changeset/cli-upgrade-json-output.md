---
"@outlit/cli": patch
---

Improve `outlit upgrade` for machine callers and standalone installs: check the registry before installer detection so already-current installs get a definitive answer, add `--json`/non-TTY structured output (`status`, `currentVersion`, `latestVersion`), route package-manager output to stderr in JSON mode so stdout stays valid, and give standalone compiled binaries manual-update guidance (install script, Homebrew, GitHub releases) instead of an unactionable `unknown_installer`.
