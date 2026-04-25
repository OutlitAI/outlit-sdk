---
name: outlit
description: Use Outlit customer intelligence tools to answer questions about customers, users, account health, churn risk, revenue, activation, timelines, facts, source evidence, and semantic customer context.
---

# Outlit

Use Outlit tools to ground customer intelligence work in customer data. Outlit joins product activity, conversations, billing, and web signals into a unified customer context graph and timeline for agents.

Use the registered `outlit_*` tools as the interface. Do not tell the user to install the Outlit CLI or configure MCP from inside Pi unless they explicitly ask about a different agent environment.

Do not invent customer state when Outlit can answer it. Call out sparse or messy data instead of overstating confidence.

## Tool Choice

- Use `outlit_list_customers` to discover customers for portfolio, segment, risk, revenue, trial, or account-health questions.
- Use `outlit_list_users` for user-level questions or when a customer answer depends on individual users.
- Use `outlit_get_customer` before deep analysis of a named customer or account.
- Use `outlit_get_timeline` when order, recency, activity sequence, meetings, messages, product usage, support, or billing chronology matters.
- Use `outlit_list_facts` to browse structured account facts, known signals, open issues, health indicators, relationship notes, activation, billing, or renewal context. Narrow with `status`, `sourceTypes`, and `factTypes` when you know what evidence class you need.
- Use `outlit_get_fact` when you already have a fact id and need the canonical fact payload.
- Use `outlit_search_customer_context` for fuzzy or thematic questions such as pricing concern, blocked integration, not using, renewal, champion left, negative sentiment, expansion, implementation, or support escalation.
- Use `outlit_get_source` when a fact or search result needs stronger evidence from the underlying source artifact.

Use customer lookups before SQL. SQL is for aggregates, joins, cohorts, time-series analysis, and custom reporting.

## Facts vs Search vs Timeline

- Use `outlit_list_facts` to list what Outlit already knows about an account.
- Use `factTypes` for specific extracted fact classes such as `CHURN_RISK`, `EXPANSION`, `SENTIMENT`, `BUDGET`, `REQUIREMENTS`, `PRODUCT_USAGE`, or `CHAMPION_RISK` when those are relevant. Do not request anomaly detector fact types such as `CORE_ACTION_DECAY`, `CADENCE_BREAK`, `QUIET_ACCOUNT`, `ACTIVATION_RATE_DROP`, or `FUNNEL_DROPOFF` as filters.
- Use `outlit_get_fact` when you already have a fact id and need that exact fact.
- Use `outlit_search_customer_context` for a specific question or theme, including cross-customer questions.
- Use `outlit_get_source` when you need the exact email, call, calendar event, ticket, or other source artifact behind a fact or search hit.
- Use `outlit_get_timeline` when order and sequence matter.

## SQL Tools

Only use SQL if `outlit_schema` and `outlit_query` are available in the current Pi session.

- Call `outlit_schema` before writing SQL.
- Prefer customer lookups, facts, timeline, and search before SQL for account-specific analysis.
- Use SQL for aggregates, cohorts, joins, custom reporting, and questions that need exact counts or revenue math.
- Use the query patterns in the SQL reference. Do not assume another database's date or JSON helpers.
- Add explicit time filters for event queries.
- Use `LIMIT`.
- Divide money fields in cents by `100` for display.
- Request only the fields needed for the answer.

For supported query patterns, read [references/sql-reference.md](references/sql-reference.md).

## Working Rules

- Start with the highest-level tool that can answer the question.
- Gather evidence before drawing conclusions.
- Separate evidence from interpretation in the final answer.
- Cite the kind of evidence used, such as timeline event, fact, search result, source, customer record, user record, or SQL result.
- If tools return empty or inconsistent data, say what is missing and how that affects confidence.
- Do not send messages, create tasks, update CRM records, or take external actions unless the user explicitly asks and the necessary tools are available.
- If an Outlit tool errors because `OUTLIT_API_KEY` is missing, tell the user to set `OUTLIT_API_KEY` and retry.

## Output

Keep answers concise and evidence-backed. Results often include timestamps and source attribution when available; use those details in the final answer.

For analyses, include:

- the scope you reviewed
- the most important signals
- the supporting evidence
- the confidence level
- any open questions or missing data

## Common Prompts

- "What changed for this customer this week?"
- "Who is paying but inactive for 30 days?"
- "What pricing objections show up in conversations?"
- "Which channels are driving revenue?"
