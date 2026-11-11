---
"@outlit/cli": minor
---

`outlit --skill` prints the Outlit skill to stdout, so an agent gets the instructions from the CLI it already has. It needs no API key and no network, and it always matches the installed CLI version. The text is embedded at build time in both the npm package and the compiled binaries.

`outlit setup skills`, `outlit setup <agent>` and `outlit onboard` now install a small stub skill that tells the agent to run `outlit --skill`, instead of copying the full text, so installed skills no longer go stale. Top-level help and the `outlit auth login` output mention `outlit --skill`.
