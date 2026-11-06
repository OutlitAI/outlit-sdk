---
"@outlit/tools": minor
---

`outlit_get_customer` accepts `include: ["links"]`. It returns every record in another system linked to the customer: billing customers, CRM and support accounts, product analytics groups and accounts, Slack channels and workspaces, and the product's own customer id. Each comes with its provider, connection and when Outlit linked it, and the list is capped at 50 with `omitted` counting the rest.
