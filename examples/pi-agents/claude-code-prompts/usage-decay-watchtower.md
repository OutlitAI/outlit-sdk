# Claude Code Prompt: Usage Decay Churn Watchtower

You are Claude Code running in a shell where the `outlit` CLI is available and already authenticated.

Run a Usage Decay Churn Watchtower review.

Scope: $ARGUMENTS

If no scope is provided, scan paying customers and identify the 5-8 strongest usage-decay churn risks.

Use only Outlit customer data through the `outlit` CLI. Do not inspect local repo files, generated scenario files, seed data, or artifact files. Infer from customer records, users, facts, timeline, billing, search, and source evidence.

Objective: find paying customers whose product behavior suggests they may cancel soon, even when there is no renewal date or explicit renewal conversation.

Process:
1. Run `outlit schema` when you need view names or fields, then use `outlit sql` to find paying customers with stale activity, declining event volume, shrinking active-user counts, or meaningful MRR.
2. Discover paying customers with CLI customer commands as needed. Prefer meaningful MRR and signs of stale or declining activity.
3. For each candidate, gather customer details, recent timeline, users, facts, billing context, and semantic search evidence.
   Use fact filters such as `outlit facts list <customer> --fact-types CHURN_RISK,SENTIMENT,PRODUCT_USAGE,CHAMPION_RISK,BUDGET --json` for customer-memory context when available.
   Do not request behavioral/anomaly fact types like `CORE_ACTION_DECAY`, `CADENCE_BREAK`, or `QUIET_ACCOUNT` as fact filters; many customers will not have configured usage paths. Use SQL/event evidence as the primary usage-decay signal.
   Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
4. Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
5. Look for changed behavior: usage decline, fewer active users, stale core workflows, disappeared champions, or quiet periods after unresolved problems.
6. Rank only after evidence review.
7. Return fewer than 8 customers if fewer have credible evidence.

Guardrails:
- Do not rank a customer just because usage is low. Explain what changed or why this usage pattern is risky for that account.
- Do not rank subscription cancellation, subscription pause, renewal negotiation, legal review, or procurement delay as usage decay unless there is also declining or stale product usage.
- Do not treat renewal negotiation, procurement delay, or pricing pushback as churn unless paired with non-use, cancellation, downgrade, or failed value realization.
- Prefer fewer results over padding the ranking with billing-risk accounts that lack product-behavior evidence.
- If product activity data is sparse or missing, say so and lower confidence.

Return this exact structure:

BEGIN_RESULT_JSON
{
  "methodology": ["short bullet"],
  "candidateReviewSummary": {
    "reviewed": 0,
    "ranked": 0,
    "excluded": 0
  },
  "topCustomers": [
    {
      "rank": 1,
      "name": "Customer name",
      "domain": "customer-domain",
      "mrrCents": 12345,
      "signalStrength": "high|medium|low|unscorable",
      "confidence": "high|medium|low",
      "whyNow": "short reason",
      "hardEvidence": ["specific dated metric, event, billing state, or user activity from Outlit"],
      "supportingContext": ["specific fact, timeline event, source snippet, or customer record"],
      "recommendedAction": "specific next action",
      "missingData": "what would change confidence or ranking"
    }
  ],
  "excludedCandidates": [
    {
      "name": "Customer name",
      "domain": "customer-domain",
      "reason": "why this candidate did not survive evidence review"
    }
  ],
  "dataQualityNotes": ["short note"],
  "openQuestions": ["short question"]
}
END_RESULT_JSON

After the JSON, add a short human-readable summary.
