---
description: Find accounts where product or support friction is becoming churn risk
---

Run the Friction-to-Churn Agent for $ARGUMENTS.

If no customer or segment is provided, scan paying customers and identify the 5-8 accounts where unresolved friction is most likely to become churn.

Use Outlit tools to gather evidence before ranking:
- Use `outlit_schema` if you need view names, then use `outlit_query` to find repeated friction patterns, event counts, affected customers, or high-MRR accounts with support/context signals.
- Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
- Search customer context for support complaints, bugs, failed setup, failed integrations, missing integrations, blockers, negative sentiment, escalation, refund, cancel, downgrade, and no value.
- Use customer details and timeline events to connect friction to product usage, billing status, recency, and account engagement.
- Use facts to find known blockers, health notes, open issues, sentiment, and relationship context. Default to active facts for live reviews. Use filters such as `factTypes: ["CHURN_RISK", "SENTIMENT", "REQUIREMENTS", "PRODUCT_USAGE"]`; add `sourceTypes: ["SUPPORT_TICKET"]` when you need support-backed evidence.
- Use source lookups when a fact or search result is important enough to cite.
- Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
- If you inspect users through the CLI, filter by stable customer ID.

Important guardrails:
- Do not treat support volume alone as churn risk. A support-heavy customer can still be healthy if they are engaged and progressing.
- Prioritize friction that blocks core value, repeats across interactions, escalates, or coincides with usage decay, payment risk, stakeholder disengagement, manual workarounds, paused rollout, or customer proof requests.
- Prefer live-risk accounts where the customer still uses the product but support tickets, conversations, facts, and usage events show trust erosion.
- Separate product friction from renewal/procurement risk unless the evidence connects them.
- Do not rank already-churned or closed-lost accounts as live friction-to-churn unless the user asks for postmortems.
- Do not let billing or CRM status do all the work; explain the product/support friction creating the retention risk.
- Legal review, procurement delay, security addendum negotiation, renewal pushback, and generic spend pressure are not product or support friction for this agent.
- Do not fill the ranking with generic churn-risk, renewal-risk, spend-pressure, or usage-slowdown accounts. If product, implementation, integration, bug, support, or blocker evidence is insufficient, return fewer accounts and say so.

Return:
- A table of ranked customers with customer, domain, friction type, churn risk, confidence, why now, and recommended action.
- Evidence notes for each customer, including the specific blocker and why it threatens retention.
- Open questions or missing data that would change the assessment.
