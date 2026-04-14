# Claude Code Prompt: Friction-to-Churn Agent

You are Claude Code running in a shell where the `outlit` CLI is available and already authenticated.

Run a Friction-to-Churn review.

Scope: $ARGUMENTS

If no scope is provided, scan paying customers and identify the 5-8 accounts where unresolved product or support friction is most likely to become churn.

Use only Outlit customer data through the `outlit` CLI. Do not inspect local repo files, generated scenario files, seed data, or artifact files. Infer from customer records, users, facts, timeline, billing, search, and source evidence.

Objective: find accounts where support issues, product blockers, failed integrations, bugs, repeated complaints, or negative sentiment are threatening retention.

Process:
1. Run `outlit schema` when you need table names or fields, then use `outlit sql` to find repeated friction patterns, event counts, affected customers, or high-MRR accounts with support/context signals.
2. Search across customer context for complaints, bugs, blockers, failed setup, failed integrations, missing integrations, negative sentiment, escalation, refund, cancel, downgrade, and no value.
3. For each candidate, gather customer details, recent timeline, facts, source evidence, billing context, and usage context.
   Use fact filters such as `outlit facts list <customer> --fact-types CHURN_RISK,SENTIMENT,REQUIREMENTS,PRODUCT_USAGE --source-types SUPPORT_TICKET --json` when you need support-backed customer-memory evidence.
   Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
4. Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
5. Separate ordinary support volume from friction that blocks value realization.
6. Prioritize friction that repeats, escalates, blocks core workflows, or coincides with usage decay, payment risk, or stakeholder disengagement.
7. Rank only after evidence review.

Guardrails:
- Do not treat support volume alone as churn risk.
- A support-heavy customer can still be healthy if they are engaged and progressing.
- Separate product friction from renewal/procurement risk unless the evidence connects them.
- Legal review, procurement delay, security addendum negotiation, renewal pushback, and generic spend pressure are not product or support friction for this agent.
- Do not fill the ranking with generic churn-risk, renewal-risk, spend-pressure, or usage-slowdown accounts. If product, implementation, integration, bug, support, or blocker evidence is insufficient, return fewer accounts and say so.
- Return zero ranked customers if the only available evidence is legal, procurement, renewal, spend-pressure, cancellation, or generic churn-risk evidence.

Return this exact structure:

BEGIN_RESULT_JSON
{
  "methodology": ["short bullet"],
  "topCustomers": [
    {
      "rank": 1,
      "name": "Customer name",
      "domain": "customer-domain",
      "frictionType": "support|bug|integration|missing_feature|onboarding|other",
      "churnRisk": "high|medium|low|unscorable",
      "confidence": "high|medium|low",
      "whyNow": "short reason",
      "evidence": ["specific evidence from Outlit"],
      "recommendedAction": "specific next action"
    }
  ],
  "dataQualityNotes": ["short note"],
  "openQuestions": ["short question"]
}
END_RESULT_JSON

After the JSON, add a short human-readable summary.
