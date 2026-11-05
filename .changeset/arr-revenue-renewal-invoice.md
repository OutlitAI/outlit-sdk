---
"@outlit/tools": minor
"@outlit/cli": minor
"@outlit/pi": patch
---

Revenue is now ARR, the annualized revenue run rate the Outlit app shows. Breaking output change for `@outlit/tools` consumers: the legacy monthly `currentMrr` and `mrrCalculationStatus` fields are removed. `outlit_list_customers` items carry `arr: { amount, currency, estimated } | null`, and `outlit_get_customer` revenue carries `arr` with its `lifecycle` and the `parts` it is counted from (subscriptions, usage, invoiced in the last 12 months). `outlit_list_customers` takes `arrAbove`, `arrBelow` and `orderBy: "arr_cents"`; `mrrAbove`, `mrrBelow` and `mrr_cents` still work but are deprecated. `outlit_get_customer` can `include` `renewal`: the renewal date the customer page shows, with its source (`outlit`, `crm` or `billing`). `outlit_get_source` and `outlit_list_sources` read Stripe invoices with every line item through the new `INVOICE` source type (`STRIPE_INVOICE` is accepted as an alias, including by `outlit sources get` and `outlit sources list`). The SQL `customers` view gains `arr_cents`, `arr_currency`, `arr_estimated` and `revenue_lifecycle`; `mrr_cents` and `mrr_status` remain for about a month, deprecated.

The CLI adds `outlit customers list --arr-above`, `--arr-below` and `--order-by arr_cents`, and the table's MRR column becomes ARR, shown with its currency. `--mrr-above`, `--mrr-below` and `mrr_cents` are still accepted but no longer advertised. The Pi SQL reference now uses `arr_cents`.
