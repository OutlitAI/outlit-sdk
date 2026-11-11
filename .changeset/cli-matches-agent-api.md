---
"@outlit/cli": minor
---

The CLI now matches the Agent API v2: a tool `outlit_<verb>_<noun>` is `outlit <noun> <verb>`, flags are the tool's input names in kebab-case, and the required target is positional.

New commands: `customer-fields list`, `tasks list|get|act|undo`, `setup-sessions get`, `timeline get`, `identity get`, `merge-suggestions list|reject`, `merges get`, `members list`, `query` and `schema get`, `feedback submit`, `integrations list`. `customers set-owner` and `customers set-access` (`--role none` removes access) replace `owner set`, `grant` and `revoke`, and take `--mode`, `--preview-token`, `--request-id` and `--undo-token`. `customers merge` takes `--mode preview|execute` and `--note`. `settings update` takes `--timezone`, `--default-owner`, `--activation-event` (`none` turns it off) and `--revision`, replacing `activation get|update|disable`. `destinations list --ids` and `destinations update --enabled true|false` replace `get`, `enable` and `disable`. `facts get <id>` and `sources get <type> <id>` take their target as arguments.

Every previous spelling keeps working until 2026-12-11. It runs the new command and prints `Renamed: use `outlit …`` once to stderr. Help, shell completions and the docs show only the new names.
