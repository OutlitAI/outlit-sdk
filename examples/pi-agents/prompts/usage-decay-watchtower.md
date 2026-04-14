---
description: Find paying customers with usage decay that may lead to churn
---

Run the Usage Decay Churn Watchtower for $ARGUMENTS.

If no customer or segment is provided, scan paying customers and identify the 5-8 strongest usage-decay churn risks.

Use Outlit tools to gather evidence before ranking:
- Use `outlit_schema` if you need table names, then use `outlit_query` to find paying customers with stale activity, declining event volume, shrinking active-user counts, or meaningful MRR.
- Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
- Start with paying customer discovery. Prioritize meaningful MRR, stale recent activity, and customers that were previously active.
- Pull customer details with revenue, users, recent timeline, and behavior metrics when available.
- Check timeline events for declining product activity, stale core workflows, disappearing users, quiet periods after problems, or payment issues.
- Search customer context for "not using", "inactive", "cancel", "downgrade", "usage down", "blocked", "no value", and similar terms.
- Use `outlit_list_facts` with customer-memory fact filters such as `factTypes: ["CHURN_RISK", "SENTIMENT", "PRODUCT_USAGE", "CHAMPION_RISK", "BUDGET"]` and `factCategories: ["MEMORY"]` when a claim needs stronger supporting context.
- Do not request behavioral/anomaly fact types like `CORE_ACTION_DECAY`, `CADENCE_BREAK`, or `QUIET_ACCOUNT` as fact filters; many customers will not have configured usage paths. Use SQL/event evidence as the primary usage-decay signal.
- Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.

Important guardrails:
- Do not rank a customer just because usage is low. Explain what changed, what value path is missing, or why the account is at risk now.
- Do not rank subscription cancellation, subscription pause, renewal negotiation, legal review, or procurement delay as usage decay unless there is also declining or stale product usage.
- Do not treat renewal negotiation, procurement delay, or pricing pushback as churn unless paired with non-use, cancellation, downgrade, or failed value realization.
- Prefer fewer results over padding the ranking with billing-risk accounts that lack product-behavior evidence.
- If product activity data is sparse or missing, say so and lower confidence.

Return:
- A table of ranked customers with customer, domain, MRR, signal strength, confidence, why now, and recommended action.
- Evidence notes for each customer, tied to timeline events, facts, search results, source snippets, or customer records.
- Missing data that would change the ranking.
