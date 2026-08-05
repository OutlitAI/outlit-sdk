---
"@outlit/tools": major
"@outlit/cli": major
"@outlit/pi": major
"@outlit/core": major
"@outlit/browser": major
"@outlit/node": major
---

Remove retired generic agent, automation, signal, identity, and notification surfaces from the public tools, CLI, and Pi packages. Public tool contracts, toolset memberships, gateway transport, OpenAPI, and ingest transport now derive from Core's capability catalog. Tracking packages expose only Platform-accepted event types; stage and billing lifecycle APIs remain removed across TypeScript and Rust.
