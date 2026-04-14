# Claude Code Prompt: Expansion Readiness Agent

You are Claude Code running in a shell where the `outlit` CLI is available and already authenticated.

Run an Expansion Readiness review.

Scope: $ARGUMENTS

If no scope is provided, scan active paying customers and identify the 5-8 strongest expansion opportunities.

Use only Outlit customer data through the `outlit` CLI. Do not inspect local repo files, generated scenario files, seed data, or artifact files. Infer from customer records, users, facts, timeline, billing, search, and source evidence.

Objective: find customers likely to upgrade, expand seats, increase usage, or move to a higher plan.

Process:
1. Run `outlit schema` when you need table names or fields, then use `outlit sql` to find usage growth, active-user growth, plan-limit patterns, high product volume, or small-plan accounts with power-user behavior.
2. Discover active paying customers with CLI customer and user commands as needed, especially small-plan or starter-plan accounts with meaningful usage.
3. Gather customer details, revenue, users, timeline, behavior metrics, facts, semantic search evidence, and source evidence.
   Use fact filters such as `outlit facts list <customer> --fact-types EXPANSION,PRODUCT_USAGE,REQUIREMENTS,SENTIMENT --json` for buying intent, plan-limit pain, premium requests, and value realization evidence.
   Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
4. Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
5. Look for usage growth, more users or teams, repeated workflows, plan-limit pain, capacity pressure, positive sentiment, premium-feature questions, and adjacent use cases.
6. Separate healthy usage from actual expansion intent.
7. Rank only after evidence review.

Guardrails:
- Do not treat healthy usage alone as expansion readiness.
- Do not rank plan mismatch, high MRR, or broad feature usage alone.
- Prioritize buying intent, plan-limit pain, capacity pressure, seat growth, or a clear next package to sell.
- Every ranked customer should have explicit expansion intent, plan-limit pain, capacity pressure, seat or team growth, a premium-feature request, or a similarly concrete expansion trigger.
- Do not recommend an expansion motion without explaining the likely expansion path.

Return this exact structure:

BEGIN_RESULT_JSON
{
  "methodology": ["short bullet"],
  "topCustomers": [
    {
      "rank": 1,
      "name": "Customer name",
      "domain": "customer-domain",
      "currentMrrCents": 12345,
      "expansionSignal": "short description",
      "confidence": "high|medium|low",
      "likelyExpansionPath": "seats|plan_upgrade|usage_volume|premium_feature|new_team|unknown",
      "evidence": ["specific evidence from Outlit"],
      "recommendedAction": "specific next action"
    }
  ],
  "dataQualityNotes": ["short note"],
  "openQuestions": ["short question"]
}
END_RESULT_JSON

After the JSON, add a short human-readable summary.
