---
"@outlit/cli": minor
"@outlit/tools": minor
"@outlit/pi": minor
---

Matches the Agent API v2 polish release of Core. Core switches its outputs on release; the old input spellings below keep working for 30 days, until 2026-12-12.

The tool contracts are regenerated. Inputs: `outlit_get_fact` takes `id` (was `factId`) and `part`, which reads one long field a page at a time; `outlit_get_setup_session` takes `id` (was `sessionId`); `outlit_get_customer` takes `fields`, selectors `{ source?, key }` (was `crmFields`), and `crmContacts`; `outlit_list_people` `fields` are selectors; `outlit_list_facts` and `outlit_search_customer_context` take `include` (`reasoning`, `quote`, `evidence`); `outlit_list_customers` takes `filters.credits`, `orderBy: "meter_usage"` and `meter`. Outputs: facts have no `reasoning` or `source.quote` unless `include` asks, and `evidence` is `{ items, page, more }`; `crmSummary` is an array of accounts on list rows and `outlit_get_customer`; enrichment funding totals are money; sections that hold only their first part (`users`, `recentTimeline`) carry `more`; `recentTimeline` entries carry `id` and `source`; customer list rows carry `credits` and `meter`; `outlit_create_destination` refuses an existing active channel; toolsets carry `cost`. Validation issues carry `message`, a 429 carries `retryAfterSeconds`, and the grants `destinations:read`, `behavior_metrics:read` and `integrations:read` exist.

`@outlit/tools` sends `x-outlit-client: <package>/<version>` on every request (`createOutlitClient` takes `client` for a package that wraps it), and keeps a 429's `retryAfterSeconds` on the error envelope. `@outlit/cli` and `@outlit/pi` send their own name and version, so Core can tell a client below a release's minimum version to upgrade.

CLI: `facts get <id>` and `setup-sessions get <id>` send `id`. `facts get` takes `--part <field>` and `--cursor`; `facts list` and `search` take `--include reasoning,quote,evidence`; `customers get` takes `--fields <key,system:key>` and `--crm-contacts <connectionId>:<accountId>` (with `--cursor`); `customers list` takes `--runs-out-within`, `--meter` and `--meter-connection`, and shows Credits and Meter columns when the rows carry them. `--crm-fields` keeps working as `--fields` until 2026-12-12 and prints `Renamed: use …` once to stderr. At a terminal, an error shows each invalid field with what to fix, `Retry in Ns.` on a rate limit and the missing permission, and a result that holds only the first part of a section prints the command that reads the rest.
