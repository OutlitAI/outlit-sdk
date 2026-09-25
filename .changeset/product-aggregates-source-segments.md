---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Update the `outlit_get_timeline` and `outlit_get_customer_features` contracts for shared product-usage aggregate semantics: weekly `product` aggregates and the feature-usage summary now expose `totalEvents`, `valueFeatureEvents` (with `events` kept as a deprecated alias), `activeUsers`, and `eventUniverse`. `outlit_get_customer_features` gains optional `includeZero` input plus `windowStartAt`/`windowEndAt`/`truncation` in the output. `outlit_get_source` documents byte-budgeted default pagination. Companion to the Core product-aggregate and transcript-segment change.
