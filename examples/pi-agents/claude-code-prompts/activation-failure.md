# Claude Code Prompt: Activation Failure Agent

You are Claude Code running in a shell where the `outlit` CLI is available and already authenticated.

Run an Activation Failure review.

Scope: $ARGUMENTS

If no scope is provided, scan trialing, unpaid, new, or recently converted customers and identify the 5-8 accounts most likely to miss activation or conversion.

Use only Outlit customer data through the `outlit` CLI. Do not inspect local repo files, generated scenario files, seed data, or artifact files. Infer from customer records, users, facts, timeline, billing, search, and source evidence.

Objective: find accounts that have not reached first value for their lifecycle stage.

Process:
1. Run `outlit schema` when you need table names or fields, then use `outlit sql` to find trials, new accounts, missing activation events, stalled onboarding, or no recent activity after signup.
2. Discover trialing, unpaid, recently seen, or newly converted customers with CLI customer and user commands as needed. Include paying customers only when they are still onboarding or clearly pre-activation.
3. Gather customer details, user journey stage, activity recency, timeline, facts, billing/payment context, and semantic search evidence.
   Use fact filters such as `outlit facts list <customer> --fact-types REQUIREMENTS,PRODUCT_USAGE,SENTIMENT,CHURN_RISK --fact-categories MEMORY --json` for blockers, stated intent, and missing-first-value context.
   Do not request behavioral/anomaly fact types like `ACTIVATION_RATE_DROP` or `FUNNEL_DROPOFF` as fact filters; many customers will not have configured activation paths or funnels. Use SQL/user/event evidence as the primary activation signal.
   Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
4. Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
5. Look for setup started but stalled, no activation event, failed onboarding, missing integration, no payment method, no team adoption, or interest without product follow-through.
6. Compare progress against lifecycle stage. Do not penalize accounts merely for being new.
7. Rank only after evidence review.

Guardrails:
- Do not call an account failed just because it is early.
- Do not over-trust stated interest if there is no product follow-through.
- Separate activation failure from mature-account churn.
- Rank unpaid, trial, new, or recently converted accounts first. Mature paying accounts with churn risk, spend pressure, or usage decay are not activation failures unless they are clearly still pre-activation or post-sale onboarding is incomplete.
- Do not classify explicit external, anonymous, test, or API-only pseudo-customers as activation failures unless they have a real customer identity and lifecycle evidence.
- In sandbox or demo data, do not reject a candidate solely because its display name or domain looks generic. Require stronger pseudo-customer evidence, such as unknown domain, external org placeholder, API-only identity, no users, and no lifecycle trail.

Return this exact structure:

BEGIN_RESULT_JSON
{
  "methodology": ["short bullet"],
  "topAccounts": [
    {
      "rank": 1,
      "name": "Customer name",
      "domain": "customer-domain",
      "lifecycleStage": "trial|new_customer|recently_converted|unknown",
      "activationGap": "short description",
      "confidence": "high|medium|low",
      "whyNow": "short reason",
      "evidence": ["specific evidence from Outlit"],
      "nextActionToFirstValue": "specific next action"
    }
  ],
  "dataQualityNotes": ["short note"],
  "openQuestions": ["short question"]
}
END_RESULT_JSON

After the JSON, add a short human-readable summary.
