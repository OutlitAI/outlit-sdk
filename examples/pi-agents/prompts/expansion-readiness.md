---
description: Find customers ready to upgrade, expand seats, or buy more
---

Run the Expansion Readiness Agent for $ARGUMENTS.

If no customer or segment is provided, scan active paying customers and identify the 5-8 strongest expansion opportunities.

Use Outlit tools to gather evidence before ranking:
- Use `outlit_schema` if you need table names, then use `outlit_query` to find usage growth, active-user growth, plan-limit patterns, high product volume, or small-plan accounts with power-user behavior.
- Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
- Start with active paying customers, especially small-plan or starter-plan accounts with meaningful usage.
- Pull customer details with revenue, users, recent timeline, and behavior metrics when available.
- Check timeline events and user activity for usage growth, additional teams, more seats, repeated workflows, and capacity pressure.
- Search customer context for "upgrade", "seats", "team", "limit", "plan", "pricing", "premium", "more users", "volume", "feature", and "use case".
- Use facts and source lookups when a buying signal or plan-limit pain needs stronger evidence. Useful customer-memory fact filters include `factTypes: ["EXPANSION", "PRODUCT_USAGE", "REQUIREMENTS", "SENTIMENT"]`.
- Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.

Important guardrails:
- Do not treat healthy usage alone as expansion readiness.
- Do not rank plan mismatch, high MRR, or broad feature usage alone.
- Prioritize buying intent, plan-limit pain, capacity pressure, seat growth, or a clear next package to sell.
- Every ranked customer should have explicit expansion intent, plan-limit pain, capacity pressure, seat or team growth, a premium-feature request, or a similarly concrete expansion trigger.
- Do not recommend an expansion motion without explaining the likely expansion path.

Return:
- A table of ranked customers with customer, domain, current MRR or plan context, expansion signal, confidence, likely expansion path, and recommended action.
- Evidence notes for each customer, tied to usage, conversations, facts, timeline events, or source snippets.
- Missing data that would improve the expansion recommendation.
