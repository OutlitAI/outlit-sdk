---
"@outlit/tools": minor
"@outlit/cli": minor
"@outlit/pi": minor
---

Customer hierarchy: a customer's parent company and its direct subsidiaries, as parent accounts in the organization's HubSpot or Salesforce CRM record them.

- `outlit_get_customer` takes `include: ["hierarchy"]`: `{ parent, children, page }`, each a customer (`id`, `name`, `domain`) with `source` (`crm`) and `since`. Children come in pages of 25 (at most 100) with `hierarchy: { limit, cursor }`. `customerIncludeSections` gains `hierarchy`.
- `outlit_list_customers` takes `filters.partOf`, a customer by ID, domain or name: only its direct subsidiaries, with every other filter and the ARR totals.
- CLI: `outlit customers get <customer> --include hierarchy` (with `--limit` and `--cursor`), and `outlit customers list --part-of <customer>`.
