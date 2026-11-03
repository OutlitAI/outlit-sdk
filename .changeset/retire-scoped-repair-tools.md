---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Remove the four scoped identity repair tools (`outlit_list_scoped_repairs`, `outlit_preview_scoped_repair`, `outlit_execute_scoped_repair`, `outlit_verify_scoped_repair`) from the generated public tool contracts and the OpenAPI document. Outlit no longer offers them to customers over MCP, the CLI, Pi or the API; scoped repairs stay available on the Identity page in the Outlit app.
