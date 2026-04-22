---
name: outlit-growth-agents
description: Use Outlit customer intelligence tools to run usage-decay churn, friction-to-churn, activation-failure, or expansion-readiness reviews.
---

# Outlit Growth Agents

Use Outlit tools to ground customer signal work in actual customer data. These agents are meant for PLG, month-to-month, and hybrid SaaS businesses where churn or expansion may show up through behavior, billing, conversations, and support context rather than annual renewal dates.

## Shared Review Process

1. Identify the task type:
   - Usage decay churn: paying accounts that may cancel because product engagement is weakening.
   - Friction-to-churn: accounts where unresolved product or support pain is becoming retention risk.
   - Activation failure: trials, new accounts, or recently converted accounts that are not reaching first value.
   - Expansion readiness: healthy customers with evidence they may upgrade, add seats, or buy more.
2. Discover candidates.
   - For usage decay churn, call `outlit_churn_pretriage` first when it is available. Treat the surfaced customers as the investigation set unless the user explicitly asks for a broader scan.
   - Use `outlit_schema` before SQL when you need view names, columns, or valid query surfaces.
   - Use `outlit_query` for cohorts, usage trends, active-user counts, activation gaps, revenue filters, event aggregates, and repeated signal patterns.
   - Use `outlit_list_customers` for portfolio scans, billing status, MRR, activity recency, and customer search.
   - Use `outlit_list_users` when account-level behavior depends on user activation, active users, or champion disappearance. When using the CLI directly, filter users with the stable customer ID, not a display name or domain.
   - Use `outlit_search_customer_context` for thematic discovery across customers.
3. Gather account evidence.
   - Use `outlit_get_customer` with relevant includes before deep analysis.
   - Prefer stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
   - Use `outlit_get_timeline` when recency, sequence, or behavior changes matter.
   - Use `outlit_list_facts` for known account facts, health indicators, support issues, billing context, activation context, and relationship notes. Default to active facts for live reviews, and use `factTypes` to narrow extracted customer-memory facts when helpful.
   - Use `outlit_get_fact` or `outlit_get_source` when a claim needs stronger evidence.
4. Rank only after reviewing evidence.
   - Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
   - Prefer stronger evidence over generic SaaS heuristics.
   - Prefer paying customers for churn and expansion work.
   - For activation failure, include trials and newly converted customers.
   - Say when data is sparse, stale, or contradictory.

## Signal Boundaries

Keep these categories separate:

- Usage decay churn: reduced or stale product behavior for a paying account, especially after prior engagement.
- Friction-to-churn: unresolved blocker, failed integration, bug, complaint, or support issue that threatens value realization.
- Activation failure: account has not reached first value for its lifecycle stage.
- Expansion readiness: account shows buying intent, capacity pressure, plan-limit pain, seat growth, or strong value realization.
- Renewal or procurement risk: contract, legal, pricing, or procurement risk. Do not call this churn unless there is cancellation, downgrade, non-use, or failed value realization evidence.
- Billing cancellation, subscription pause, legal review, procurement delay, or renewal risk can support a finding, but they do not replace the specific evidence required by each agent.
- Behavioral/anomaly fact types can be useful if present, but do not require or assume them. Many customers will not have configured core actions, activation paths, or funnel paths. Use SQL over the activity, users, and revenue views as the primary source for usage decay and activation analysis.

## Useful Fact Filters

When calling `outlit_list_facts`, prefer non-behavioral customer-memory filters:

- Usage decay churn: `factTypes: ["CHURN_RISK", "SENTIMENT", "PRODUCT_USAGE", "CHAMPION_RISK", "BUDGET"]`.
- Friction-to-churn: `factTypes: ["CHURN_RISK", "SENTIMENT", "REQUIREMENTS", "PRODUCT_USAGE"]`; use `sourceTypes: ["SUPPORT_TICKET"]` when looking for support-backed evidence.
- Activation failure: `factTypes: ["REQUIREMENTS", "PRODUCT_USAGE", "SENTIMENT", "CHURN_RISK"]`.
- Expansion readiness: `factTypes: ["EXPANSION", "PRODUCT_USAGE", "REQUIREMENTS", "SENTIMENT"]`.

Do not request `CORE_ACTION_DECAY`, `CADENCE_BREAK`, `QUIET_ACCOUNT`, `ACTIVATION_RATE_DROP`, or `FUNNEL_DROPOFF` as fact filters. Those come from anomaly detectors and are not part of the public filter surface for these agents.

## Agent-Specific Guidance

### Usage Decay Churn

Look for:

- declining usage or fewer active users
- stale recent activity after prior engagement
- core workflows no longer used
- power users or champions disappearing
- paying accounts with no meaningful product activity
- deterministic pretriage matches from `outlit_churn_pretriage`, including stale activity, low active days, usage drops, past-due billing, stale users, or all recently active users becoming inactive

Avoid:

- ranking a customer only because usage is low
- ranking subscription cancellation, subscription pause, renewal negotiation, legal review, or procurement delay as usage decay unless there is also declining or stale product usage
- ranking already-churned accounts as live churn risks unless the user explicitly asks for postmortems
- treating a new or tiny customer like a mature account
- treating renewal negotiation as churn without product or cancellation evidence
- padding a ranking when pretriage or discovery candidates do not survive evidence review

Output discipline:

- Start with `Candidate review summary:` and state reviewed, ranked, and excluded counts.
- For each ranked customer, include a hard signal, supporting context, confidence, recommended action, and missing data.
- Include excluded candidates with a short reason when candidates were reviewed but not ranked.
- If a usage-decay review inspects an already-churned account, include it in `excludedCandidates` with an exclusion reason instead of `rankedCustomers`; keep `candidateReviewSummary` counts aligned with the reviewed, ranked, and excluded totals in `slackNotificationDraft`.
- Do not send notifications from the usage-decay command or prompt. Return the churn review findings only.
- For usage-decay, include one parseable JSON object between `BEGIN_CHURN_WATCHTOWER_JSON` and `END_CHURN_WATCHTOWER_JSON` with `candidateReviewSummary`, `rankedCustomers`, `excludedCandidates`, `dataQualityNotes`, `openQuestions`, and `slackNotificationDraft`.
- Do not rename JSON keys. Use `mrrCents`, confidence values `high`/`medium`/`low`, and a non-null `slackNotificationDraft` object.
- Treat pretriage activity metrics as hard behavior evidence. If timeline/search/fact context is sparse, lower confidence instead of excluding solely for sparse context.

### Friction-to-Churn

Look for:

- repeated complaints
- unresolved blockers
- failed implementation or integration attempts
- negative sentiment tied to value realization
- support pain paired with usage decay, payment risk, or disengagement
- continued usage with declining trust, manual workarounds, paused rollout, or proof requests after a product/support issue
- source-backed patterns that connect support, conversations, facts, and product behavior into one account story

Avoid:

- treating support volume alone as risk
- ignoring customers who are noisy because they are deeply engaged
- ranking already-churned or closed-lost accounts as live friction-to-churn unless the user explicitly asks for postmortems
- treating a closed-lost CRM stage as stronger evidence than current support, conversation, usage, and fact context
- treating legal review, procurement delay, security addendum negotiation, renewal pushback, or generic spend pressure as product or support friction
- filling the ranking with generic churn-risk, renewal-risk, spend-pressure, or usage-slowdown accounts when direct product, implementation, integration, bug, support, or blocker evidence is missing

Investigation discipline:

- For top candidates, use facts and search before final ranking when those tools are available.
- Prefer live-risk accounts where the risk is subtle but source-backed: the customer still uses the product, but support tickets, emails, calls, Slack/internal notes, or usage events show trust erosion.
- When facts reference underlying sources, inspect the fact or source when needed instead of relying only on the assertion text.
- Do not let billing or CRM status do all the work; the finding should still explain the product/support friction that is creating the retention risk.

### Activation Failure

Look for:

- trial or new account with no activation event
- setup started but stalled
- onboarding or integration blockers
- conversation interest without product follow-through
- no payment method or no team adoption after initial signup

Avoid:

- calling an account failed just because it is early
- ignoring stated intent if the product behavior contradicts it
- ranking mature paying churn-risk accounts unless they are clearly still pre-activation or post-sale onboarding is incomplete
- classifying explicit external, anonymous, test, or API-only pseudo-customers as activation failures unless they have a real customer identity and lifecycle evidence
- rejecting a candidate solely because sandbox or demo data uses generic names or domains; require stronger pseudo-customer evidence, such as unknown domain, external org placeholder, API-only identity, no users, and no lifecycle trail

### Expansion Readiness

Look for:

- usage growth across users, teams, or workflows
- plan limits, seat pressure, or volume constraints
- starter/small-plan accounts with power-user behavior
- positive sentiment and clear value realization
- questions about premium capabilities or adjacent use cases

Avoid:

- treating healthy usage alone as expansion intent
- ranking plan mismatch, high MRR, or broad feature usage without buying intent, plan-limit pain, capacity pressure, seat or team growth, or a premium-feature request
- recommending outreach without a concrete expansion path

## Output Rules

For portfolio reviews, return a compact table first:

```markdown
| Customer | Signal | Confidence | Why now | Recommended action |
| --- | --- | --- | --- | --- |
```

Then include short evidence notes for each ranked customer:

- customer name and domain
- billing or lifecycle context
- evidence used
- why the category applies
- what would change the assessment

You may call `outlit_send_notification` only when the user explicitly asks you to send, post, or notify a result to Slack and the action tool is available. In this example package, action tools are opt-in with `OUTLIT_PI_ENABLE_ACTION_TOOLS=true`. The usage-decay command and prompt are read-only and should return findings without sending Slack notifications.

When using `outlit_send_notification`:

- keep `title` short and specific
- use `message` for a brief summary
- set `severity` only to `low`, `medium`, or `high`
- put the complete result object or text in `payload` without assuming a fixed shape

Do not send messages, create tasks, update CRM records, or take external actions unless the user explicitly asks and the necessary tools are available.
