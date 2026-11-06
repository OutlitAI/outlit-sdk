---
"@outlit/tools": minor
"@outlit/cli": minor
---

`outlit_setup_integration` gains an optional Stripe step: a ready Stripe connection can return a `stripe_renewal_date_field` next transition listing subscription metadata keys, and accepts `configuration: { kind: "stripe_renewal_date_field", key }` (or `key: null`) to choose the field renewal dates are read from.

`outlit integrations setup stripe` lists the metadata keys and lets you pick the renewal date field or skip it; with `--json` or `--config-stdin` it returns the step so an agent can rerun with the chosen key.
