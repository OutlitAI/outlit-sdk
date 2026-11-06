---
"@outlit/tools": minor
---

`outlit_get_customer` can `include` `crm`: each CRM or support tool account linked to the customer, with its owner as that system records it and every non-empty field as stored, labelled, custom fields included. Fields past the response's size limit are counted in `omittedFieldCount` and named in `omittedFields` while they fit, and the new `crmFields` input asks for fields by key or label. The section is enabled per workspace. `revenue.activeSubscriptions` is now described: it counts active, trialing and past-due subscriptions.
