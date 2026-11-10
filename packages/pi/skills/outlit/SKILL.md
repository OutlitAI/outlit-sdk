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
- Use `outlit_list_customer_fields` to find a CRM, support tool or trait field and the values customers hold before filtering `outlit_list_customers` by it (`filters.fields`) or returning it (`fields`). Filters live under `filters`; page with `page.nextCursor`.
- Use `outlit_list_people` for questions about the people at customers: who the champion or decision maker is, who went quiet, who last spoke to us. Pass `customer` for one account, which also lists the people its CRM companies link to. Filters live under `filters`; each person carries `lastCommunication` (the latest conversation they took part in, never product use).
- Use `outlit_get_customer` before deep analysis of a named customer or account.
  Each included section reports a `status`: only `available` has `data`; `empty`, `not_connected`, `not_synced` and `unavailable` say why there is none, which is not the same as zero. Money values carry `formatted` text; show it as is.
  Ask for what the answer needs with `include`: `relationship` (a summary and up to eight current statements), `features` (product-event features), `meters` (Autumn metered quantities) and `credits` (credit pools with balance and burn rate). `features`, `meters` and `credits` come in pages of 25; page one with its own `limit` and `cursor`.
- Use `outlit_get_timeline` when order, recency, activity sequence, meetings, messages, product usage, support, or billing chronology matters.
- Use `outlit_list_facts` to browse structured account facts, known signals, open issues, health indicators, relationship notes, activation, billing, or renewal context. Narrow with `status`, `sourceTypes`, and `factTypes` when you know what evidence class you need.
- Use `outlit_get_fact` when you already have a fact id and need the canonical fact payload.
- Use `outlit_search_customer_context` for fuzzy or thematic questions such as pricing concern, blocked integration, not using, renewal, champion left, negative sentiment, expansion, implementation, or support escalation.
- Use `outlit_list_sources` to discover the source artifacts available for a customer before retrieving one in full.
- Use `outlit_get_source` when a fact or search result needs stronger evidence from the underlying source artifact.
- Use `outlit_get_customer` with `include: ["features"]` for exact, customer-level Feature observations. Treat unavailable coverage as unknown, not zero usage.
- Use `outlit_list_features` to inspect the confirmed workspace taxonomy, historical evidence, eligible sources, and event candidates.
- Use `outlit_create_feature` only when the user explicitly asks to configure one confirmed product capability from one exact event rule. Outlit creates the supporting usage metrics internally.
- Use `outlit_archive_feature` only when the user explicitly asks to archive a feature and supplies the current opaque id and revision. The MVP has no restore operation and rejects archiving the final active feature.
- Use `outlit_list_toolsets` when a tool you need is not in your list; `outlit_load_toolset` returns one toolset's tool definitions.
- Use `outlit_submit_feedback` when the user wants to report an Outlit product bug, idea, or friction. Feedback is product intake, not a support ticket or a guaranteed reply. Put diagnostics in `context`, never secrets or unnecessary customer data.

Use customer lookups before SQL. SQL is for aggregates, joins, cohorts, time-series analysis, and custom reporting.

## Facts vs Search vs Timeline

- Use `outlit_list_facts` to list what Outlit already knows about an account.
- Use `factTypes` for specific public fact classes such as `CHURN_RISK`, `EXPANSION`, `PRODUCT_USAGE`, `CONTACT_DEPARTURE`, `CONTACT_POSITION_CHANGE`, or `CONTACT_DISENGAGEMENT` when those are relevant. Do not request anomaly detector fact types such as `CORE_ACTION_DECAY`, `CADENCE_BREAK`, `QUIET_ACCOUNT`, `ACTIVATION_RATE_DROP`, or `FUNNEL_DROPOFF` as filters.
- Use `outlit_get_fact` when you already have a fact id and need that exact fact.
- Use `outlit_search_customer_context` for a specific question or theme, including cross-customer questions.
- Use `outlit_get_source` when you need the exact email, call, calendar event, ticket, or other source artifact behind a fact or search hit.
- Use `outlit_get_timeline` when order and sequence matter.

## SQL Tools

Only use SQL if `outlit_get_schema` and `outlit_query` are available in the current Pi session.

- Call `outlit_get_schema` before writing SQL. `topic: "examples"` returns worked queries that run as written.
- Prefer customer lookups, facts, timeline, and search before SQL for account-specific analysis.
- Use SQL for aggregates, cohorts, joins, custom reporting, and questions that need exact counts or revenue math.
- Use the query patterns in the SQL reference. Do not assume another database's date or JSON helpers.
- Add explicit time filters for event queries.
- Use `LIMIT`.
- Money columns are minor units: divide `arr_amount` by `10^arr_decimals`, and never add amounts across `arr_currency`.
- A result page holds at most `limit` rows (default 100, max 1000); send `page.nextCursor` with the same SQL for the next page.
- Request only the fields needed for the answer.

For supported query patterns, read [references/sql-reference.md](references/sql-reference.md).

## Working Rules

- Start with the highest-level tool that can answer the question.
- Gather evidence before drawing conclusions.
- Separate evidence from interpretation in the final answer.
- Cite the kind of evidence used, such as timeline event, fact, search result, source, customer record, user record, or SQL result.
- If tools return empty or inconsistent data, say what is missing and how that affects confidence.
- Do not send messages, create tasks, update CRM records, or take external actions unless the user explicitly asks and the necessary tools are available.
- Do not create or archive Features unless the user explicitly asks. Treat feature usage only as observed product evidence.
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
