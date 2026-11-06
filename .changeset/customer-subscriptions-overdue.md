---
"@outlit/tools": minor
---

`outlit_get_customer` with `include` `revenue` returns `revenue.subscriptions`, each live subscription with every item (product name, price, quantity, unit amount, interval, licensed or metered), and `revenue.overdueInvoices`, open invoices past their due date with days overdue. `arr.parts.invoicedLast12Months` is now described as what it always was, invoice charges outside subscriptions, and `outlit_get_source` says invoice lines are what one invoice billed, not the subscription's items.
