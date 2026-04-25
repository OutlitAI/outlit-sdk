---
description: Find paying customers with usage decay that may lead to churn
---

Run the Usage Decay Churn Watchtower for $ARGUMENTS.

If no customer or segment is provided, scan paying customers and identify the 5-8 strongest usage-decay churn risks.

Use Outlit tools to gather evidence before ranking:
- If `outlit_churn_pretriage` is available, call it first with `scopeProfile: "revenue_accounts"` and use the surfaced customers as the investigation set.
- Use `outlit_schema` if you need view names, then use `outlit_query` to find paying customers with stale activity, declining event volume, shrinking active-user counts, or meaningful MRR.
- Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
- Start with paying customer discovery. Prioritize meaningful MRR, stale recent activity, and customers that were previously active.
- Pull customer details with revenue, users, recent timeline, and behavior metrics when available.
- Check timeline events for declining product activity, stale core workflows, disappearing users, quiet periods after problems, or payment issues.
- Search customer context for "not using", "inactive", "cancel", "downgrade", "usage down", "blocked", "no value", and similar terms.
- Use `outlit_list_facts` with customer-memory fact filters such as `factTypes: ["CHURN_RISK", "SENTIMENT", "PRODUCT_USAGE", "CHAMPION_RISK", "BUDGET"]` when a claim needs stronger supporting context.
- Do not request behavioral/anomaly fact types like `CORE_ACTION_DECAY`, `CADENCE_BREAK`, or `QUIET_ACCOUNT` as fact filters; many customers will not have configured usage paths. Use SQL/event evidence as the primary usage-decay signal.
- Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.

Important guardrails:
- Do not rank a customer just because usage is low. Explain what changed, what value path is missing, or why the account is at risk now.
- Do not rank subscription cancellation, subscription pause, renewal negotiation, legal review, or procurement delay as usage decay unless there is also declining or stale product usage.
- Do not treat renewal negotiation, procurement delay, or pricing pushback as churn unless paired with non-use, cancellation, downgrade, or failed value realization.
- Prefer fewer results over padding the ranking with billing-risk accounts that lack product-behavior evidence.
- If product activity data is sparse or missing, say so and lower confidence.

Return:
- Start with "Candidate review summary:" and state how many candidates were reviewed, ranked, and excluded.
- A table of ranked customers with customer, domain, MRR, signal strength, hard evidence, supporting context, confidence, recommended action, and missing data.
- An "Excluded candidates:" section when any reviewed customer was dropped, with a one-line reason for each exclusion.
- Evidence notes for each ranked customer, tied to timeline events, facts, search results, source snippets, customer records, or the pretriage payload.
- No ranked table if no customer survives the evidence gate.

Notification:
- If at least one customer survives the evidence gate, call `outlit_send_notification` exactly once before your final answer.
- Use title "Usage Decay Churn Watchtower: Churn Risks".
- Set source to "outlit-pi-usage-decay-watchtower".
- Set severity to "high" when any ranked customer has high confidence or high signal strength; otherwise set severity to "medium".
- Use message to summarize how many usage-decay churn risks were found.
- Set payload to a JSON-compatible object with candidateReviewSummary, topCustomers, excludedCandidates, dataQualityNotes, and openQuestions.
- Do not call `outlit_send_notification` if no customer survives the evidence gate.
