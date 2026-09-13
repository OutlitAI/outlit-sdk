---
"@outlit/tools": patch
"@outlit/cli": patch
---

Add `outlit customers credits <customer>` and its public tool `outlit_get_customer_credits`, and sync the generated contract with Core. The command returns imported customer credit pools, observation state, reset timing, and deterministic burn summaries. Stable publication requires the matching Core change to be deployed and verified first.
