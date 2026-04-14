---
name: outlit-churn-review
description: Review churn risk, retention health, renewal risk, or account health using Outlit customer intelligence tools. Use when asked to analyze customer churn, find at-risk customers, or prepare a retention action plan.
---

# Outlit Churn Review

Use Outlit tools to ground every churn assessment in customer data. Do not infer customer health from memory or generic SaaS patterns when Outlit can answer it.

## Review Process

1. Identify the scope.
   - If the user names a customer, call `outlit_get_customer` first.
   - If the user asks for a portfolio review, call `outlit_list_customers` to find likely risky paying or trialing customers. Prefer customers with no recent activity, high MRR, past due status, or concerning names/segments the user mentioned.
2. Build customer context.
   - Use `outlit_get_timeline` for recent activity, communications, meetings, support events, and product usage.
   - Use `outlit_list_facts` for structured account facts, open issues, sentiment, activation, billing, renewal, or relationship signals.
   - Use `outlit_search_customer_context` for fuzzy questions like "pricing concern", "blocked integration", "not using", "renewal", "champion left", or "negative sentiment".
   - Use `outlit_get_fact` or `outlit_get_source` when a claim needs stronger evidence.
3. Score churn risk.
   - High: multiple recent negative signals, no recent product activity, renewal/payment risk, unresolved blockers, or sponsor/champion loss.
   - Medium: one meaningful risk signal, weak activation, declining activity, or stale engagement.
   - Low: recent healthy activity, positive sentiment, active users, and no unresolved blockers in available evidence.
4. Write the recommendation.
   - Tie each risk signal to evidence from timeline events, facts, search results, or source snippets.
   - Separate evidence from interpretation.
   - Call out missing or messy data instead of overstating confidence.

## Output Format

Use this structure:

```markdown
## Churn Review

**Scope:** <customer or segment>
**Risk:** High | Medium | Low
**Confidence:** High | Medium | Low

### Why
- <signal> - <evidence>

### Recommended Actions
- <action owner or team> should <specific action> because <evidence-backed reason>.

### Open Questions
- <question or missing data that would change the assessment>
```

For portfolio reviews, start with a compact table:

```markdown
| Customer | Risk | Main Signal | Suggested Action |
| --- | --- | --- | --- |
```

## Guardrails

- Do not send messages, create CRM tasks, or take external actions unless the user explicitly asks.
- Do not include private source text unless it is necessary; summarize sensitive evidence.
- If an Outlit tool errors because `OUTLIT_API_KEY` is missing, tell the user to set `OUTLIT_API_KEY` and retry.
