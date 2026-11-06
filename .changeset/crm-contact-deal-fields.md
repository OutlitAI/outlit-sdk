---
"@outlit/tools": minor
---

CRM fields for contacts and deals. `outlit_list_users` can `include` `crm`. Users there, and in `outlit_get_customer` when both `users` and `crm` are included, then carry `crm`: one entry per linked CRM contact, with its labelled fields. A user whose contacts didn't fit the response's size limit says how many were left out in `omittedCrmContacts`. `outlit_get_source` on an opportunity carries the deal's labelled fields. Enabled per workspace with the account `crm` section.
