---
"@outlit/tools": patch
"@outlit/cli": patch
---

Add `outlit customers credits <customer>` and its public tool `outlit_get_customer_credits`, and sync the generated contract with Core. The command returns imported customer credit pools, observation state, reset timing, and deterministic burn summaries. Stable publication requires the matching Core change to be deployed and verified first.

Expand `outlit customers features` and `outlit_get_customer_features` to return event and imported metered usage with source availability, coverage, and optional weekly history. Credit pools belong to the dedicated Credits command; remove the unreleased `featureBalances` section from customer-get includes. Existing `recentTimeline` and `behaviorMetrics` includes remain unchanged.
