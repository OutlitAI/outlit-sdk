---
"@outlit/browser": major
"@outlit/core": major
"@outlit/node": major
---

Remove the manual `user.activate()`, `user.engaged()`, `user.inactive()`, `customer.trialing()`, `customer.paid()`, and `customer.churned()` APIs together with the `StageEvent`, `BillingEvent`, `ExplicitJourneyStage`, `BillingStatus`, and `CustomerIdentifier` ingest types. Send ordinary identity and product events with `identify()` and `track()`; Outlit Core derives activation from the customer-selected ordinary activation event, derives engagement and inactivity from activity, and receives billing status from verified integrations.
