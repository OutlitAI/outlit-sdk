---
"@outlit/cli": minor
---

Fail on input the CLI does not understand instead of ignoring it. An unknown flag, an extra or misplaced positional argument, a flag without its value, or an unknown subcommand now exits 1 before any request, naming the bad input, suggesting the closest valid flag, and listing the valid flags (as JSON on stderr when piped or with `--json`). For example, `outlit sources list acme.com --source-types CALL` used to return the whole workspace's newest sources; it now fails and suggests `--source-type` and `--customer acme.com`.

Every command that reads one customer takes `--customer <domain|name|id>`, next to the existing `<customer>` positional where there is one. `users list`, `attention list`, `identity suggestions list`, and `customers identity` resolve a domain or exact name to the customer ID first and fail with `customer_not_found` or `ambiguous_customer` when it matches no customer or several. `--customer-id` keeps working as an unadvertised alias.
