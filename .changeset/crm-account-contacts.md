---
"@outlit/tools": minor
"@outlit/pi": minor
---

Each account in `outlit_get_customer`'s `crm` section lists the contacts that system associates with it, whatever their email domain: up to 25, with name, email, title and `userId` (the customer's user with that contact, or `null`). More are counted in `omittedContactCount`.

`outlit_list_customers` takes `crm` filters on CRM and support tool account fields and `crmFields`, which returns those fields' values on each customer. New `outlit_list_crm_fields` lists the fields, with picklist options, the values linked accounts hold, and how many hold one. It joins `defaultToolNames`, so `@outlit/pi` registers it by default.
