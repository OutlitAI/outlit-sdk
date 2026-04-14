---
description: Find trials or new customers that are unlikely to activate or convert
---

Run the Activation Failure Agent for $ARGUMENTS.

If no customer or segment is provided, scan trialing, unpaid, new, or recently converted customers and identify the 5-8 accounts most likely to miss activation or conversion.

Use Outlit tools to gather evidence before ranking:
- Use `outlit_schema` if you need table names, then use `outlit_query` to find trials, new accounts, missing activation events, stalled onboarding, or no recent activity after signup.
- Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
- Start with trialing, unpaid, or recently seen customers. Include paying customers only when they are new or still onboarding.
- Check users and customer details for journey stage, activity recency, team adoption, activation indicators, and recent behavior.
- Review timeline events for signup, onboarding, integration work, product usage, payment, support, and communications.
- Search customer context for "setup", "onboarding", "blocked", "integration", "trial", "payment", "activate", "implementation", "not working", and "next steps".
- Use facts and source lookups for blockers, stated intent, missing payment, and activation milestones. Useful customer-memory fact filters include `factTypes: ["REQUIREMENTS", "PRODUCT_USAGE", "SENTIMENT", "CHURN_RISK"]` with `factCategories: ["MEMORY"]`.
- Do not request behavioral/anomaly fact types like `ACTIVATION_RATE_DROP` or `FUNNEL_DROPOFF` as fact filters; many customers will not have configured activation paths or funnels. Use SQL/user/event evidence as the primary activation signal.
- Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.

Important guardrails:
- Do not call an account failed just because it is early. Compare progress against its lifecycle stage and expected next action.
- Do not over-trust stated interest if there is no product follow-through.
- Separate activation failure from mature-account churn.
- Rank unpaid, trial, new, or recently converted accounts first. Mature paying accounts with churn risk, spend pressure, or usage decay are not activation failures unless they are clearly still pre-activation or post-sale onboarding is incomplete.
- Do not classify explicit external, anonymous, test, or API-only pseudo-customers as activation failures unless they have a real customer identity and lifecycle evidence.
- In sandbox or demo data, do not reject a candidate solely because its display name or domain looks generic. Require stronger pseudo-customer evidence, such as unknown domain, external org placeholder, API-only identity, no users, and no lifecycle trail.

Return:
- A table of ranked accounts with customer, domain, lifecycle stage, activation gap, confidence, why now, and recommended action.
- Evidence notes for each account, tied to product behavior, conversations, timeline events, facts, or billing context.
- The one next action most likely to get each account to first value.
