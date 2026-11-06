---
"@outlit/tools": minor
"@outlit/cli": minor
---

`outlit_list_customers` accepts `arrCurrency` to keep customers whose ARR is in one currency, and its response carries `arrCurrencies`, the currencies among the matched customers, whenever it ordered or bounded by ARR. Outlit never converts ARR, so more than one currency there means the ranking compared amounts in different currencies. `outlit customers list` gains `--currency`.
