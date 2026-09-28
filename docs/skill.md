---
name: outlit
description: Use when accessing Outlit customer intelligence through the `outlit` CLI, Outlit MCP tools, Pi tools, or @outlit/tools, including customer lookups, users, workspace users, timelines, facts, source evidence, semantic search, revenue, churn, SQL analytics, identity splits, merge suggestions, setup, integrations, or troubleshooting agent access.
metadata:
  openclaw:
    homepage: "https://outlit.ai"
    emoji: "🔦"
    requires:
      bins: [outlit]
    primaryEnv: OUTLIT_API_KEY
    install:
      - kind: node
        package: "@outlit/cli"
        bins: [outlit]
      - kind: brew
        formula: outlitai/tap/outlit
        bins: [outlit]
---

# Outlit

Outlit joins product activity, conversations, billing, support, CRM, and web signals into customer profiles, timelines, facts, and source evidence for agents.

## When to Use Outlit

Use Outlit when the user needs real customer context for onboarding, adoption, retention, renewal, or expansion. Typical jobs include:

- Find accounts with declining activity, renewal risk, expansion demand, or stalled onboarding.
- Explain what changed for a customer and trace the answer to facts, events, conversations, or source records.
- Prepare account research, customer-success follow-up, or custom analytics across customer data.
- Inspect or configure an Outlit workspace capability when the user explicitly asks.

Do not call Outlit for generic customer-success advice that does not need workspace data. Use the `outlit-sdk` skill instead when the user wants to instrument an application with tracking SDKs.

## Choose the Interface

Use the highest-level interface already available:

1. If suitable `outlit_*` MCP or Pi tools are present, call them.
2. Otherwise, if the `outlit` CLI is installed, use it.
3. Otherwise, guide setup:
   - Coding agents: run `outlit onboard --agent <agent> --json`. Outside CI, it can start browser approval when no key is available, install this skill, validate access, and return next actions.
   - Skills only: run `outlit setup --yes` or `outlit setup skills`.
   - MCP clients: use the workspace URL from **Settings > CLI & MCP** and complete OAuth in the client. Do not hardcode a shared endpoint, bearer header, or API key into remote MCP configuration.

## Quick Chooser

Tool availability depends on the MCP server or Pi tool policy. If a named tool is absent, use the CLI only where your policy permits, or ask the user to enable the appropriate toolset.

| Need | Tool when exposed | CLI |
|------|-------------------|-----|
| Browse customers | `outlit_list_customers` | `outlit customers list` |
| Browse customer-associated users | `outlit_list_users` | `outlit users list` |
| Browse workspace users | `outlit_list_workspace_users` | `outlit ws-users list` |
| Single account profile | `outlit_get_customer` | `outlit customers get` |
| Current customer relationship | `outlit_get_customer_relationship` | `outlit customers relationship` |
| Chronology | `outlit_get_timeline` | `outlit customers timeline` |
| Known structured signals | `outlit_list_facts`, `outlit_get_fact` | `outlit facts list/get` |
| Source enumeration and retrieval | `outlit_list_sources`, `outlit_get_source` | `outlit sources list/get` |
| Thematic or fuzzy question | `outlit_search_customer_context` | `outlit search` |
| Custom analytics | `outlit_schema`, then `outlit_query` | `outlit schema`, then `outlit sql` |
| Customer ownership and access | `outlit_assign_customer_owner`, `outlit_grant_customer_access`, `outlit_update_customer_access`, `outlit_revoke_customer_access` | `outlit customers owner set`, `outlit customers grant/revoke` |
| Browse automation destinations | `outlit_list_destinations`, `outlit_get_destination` | `outlit destinations list/get` |
| Configure automation destinations | `outlit_create_destination`, `outlit_update_destination` | `outlit destinations create/update` |
| Destination lifecycle | `outlit_enable_destination`, `outlit_disable_destination`, `outlit_archive_destination` | `outlit destinations enable/disable/archive` |
| Integration readiness or setup | `outlit_get_integration_capabilities`, `outlit_begin_integration_setup`, `outlit_get_integration_setup_status`, `outlit_get_integration_status`, `outlit_setup_integration` | `outlit integrations setup/status` |
| Activation setting | `outlit_get_customer_activation`, `outlit_preview_customer_activation`, `outlit_update_customer_activation` | `outlit activation get/preview/update/disable` |
| Workspace timezone | `outlit_get_workspace_settings`, `outlit_update_workspace_settings` | `outlit settings get/update` |
| Workspace Features | `outlit_list_features`, `outlit_create_feature`, `outlit_archive_feature` | `outlit features list/create/archive` |
| Customer Feature usage | `outlit_get_customer_features` | `outlit customers features` |
| Review current Attention items | `outlit_list_attention_items`, `outlit_get_attention_item` | `outlit attention list/get` |
| Diagnose possible identity splits | `outlit_get_customer_identity` | `outlit customers identity <customerId>` |
| Browse saved merge suggestions and history | `outlit_list_identity_merge_suggestions` | `outlit identity suggestions list` |
| Reject a saved suggestion | `outlit_reject_identity_merge_suggestion` | `outlit identity suggestions reject <suggestionId>` |
| Preview or execute a customer merge | `outlit_merge_customers` | `outlit customers merge <survivorId> <duplicateId>` |
| Track a merge operation | `outlit_get_customer_merge_status` | `outlit customers merge-status <operationId>` |

`outlit customers grant` also updates an existing collaborator's role; access commands are siblings of `owner`, not subcommands of it.

Customer-associated users belong to customer accounts. Workspace users are internal Outlit members used for ownership and access actions. Do not substitute one ID type for the other.

Use customer lookups before SQL. SQL is for aggregates, cohorts, joins, time-series checks, and custom reporting.

## Working Rules

- Start with the highest-level tool that can answer the question.
- Gather evidence before drawing conclusions, and separate evidence from interpretation.
- Cite the evidence kind: customer, user, workspace user, relationship item, timeline event, fact, search result, source, Attention item, Feature usage, or SQL result.
- Say when data is sparse, stale, truncated, partial, or inconsistent and how that affects confidence.
- Request only the fields or include sections needed.
- Treat write operations as changes to the user's workspace. Assign owners, change access, configure integrations, reject merge suggestions, merge customer records, or mutate destinations, activation, settings, and Features only when the user explicitly asks.
- Do not treat integration `ready` status as proof that a sync or backfill finished or that customer data is current.

## Facts, Search, Sources, and Timeline

- Use `facts list` to browse known structured intelligence for one account.
- Public `factTypes` filters accept `CUSTOM`, `COMPANY_CHANGE`, `FUNDING_REVENUE`, `TECHNOLOGY`, `STRATEGY`, `COMPETITIVE`, `SENTIMENT`, `CHAMPION_RISK`, `EXPANSION`, `CHURN_RISK`, `TIMELINE`, `BUDGET`, `DECISION_MAKER`, `REQUIREMENTS`, `PRODUCT_USAGE`, `CONTACT_INFO`, `CONTACT_PREFERENCE`, `CONTACT_DEPARTURE`, `CONTACT_POSITION_CHANGE`, and `CONTACT_DISENGAGEMENT`.
- Public `factCategories` filters accept `MEMORY`, `RELATIONSHIP`, and `CUSTOM`.
- Contact-transition facts are neutral, source-backed observations about a known contact:
  - `CONTACT_DEPARTURE`: the contact left or is leaving the customer's company. Exclude temporary leave, ordinary out-of-office notices, candidates, and people discussed as part of the customer's own business.
  - `CONTACT_POSITION_CHANGE`: the contact changed title, department, team, or professional responsibility at the customer's company. This is not an Outlit relationship-role change; use `CONTACT_DEPARTURE` if the person left the company.
  - `CONTACT_DISENGAGEMENT`: the contact explicitly stopped participating, organizing, responding, or owning the initiative. A single unanswered message, scheduling friction, or an out-of-office notice is insufficient. It remains extractable but does not currently wake Churn; current contact-transition Churn signals cover only confirmed departures and position changes.
- `CHAMPION_RISK` remains historical and readable, but new extraction uses the specific contact-transition types instead of inferring a broad relationship judgment.
- Do not request internal anomaly-detector types such as `CORE_ACTION_DECAY`, `CADENCE_BREAK`, `QUIET_ACCOUNT`, `ACTIVATION_RATE_DROP`, or `FUNNEL_DROPOFF` as public fact filters.
- Use `facts get` with a known fact ID for the canonical payload or best-effort `evidence`.
- Use `search` for a specific question or theme, including cross-customer questions. Search returns grouped source and fact artifacts, not raw vector chunks.
- Use `sources list` for deterministic enumeration of emails, calls, calendar events, support tickets, CRM opportunities, or Slack messages.
- Use `sources get` when another result points to a concrete source and you need the exact artifact.
- Use `timeline` when order, recency, or sequence matters.

Supported generic source types are `EMAIL`, `CALL`, `CALENDAR_EVENT`, `SUPPORT_TICKET`, `OPPORTUNITY`, and `SLACK`. `CRM` and `CRM_OPPORTUNITY` are accepted aliases for opportunity filters.

## Identity and Customer Merges

When calls or other communications exist but product usage is absent, use `outlit_get_customer_identity` for bounded split-record diagnosis alongside source readiness and usage checks. Candidates and shared participants are leads, not permission to combine evidence or proof of one company. Empty or incomplete identity results do not establish inactivity.

Merging is dangerous and has no supported undo. Only execute when the user authorized it and the records are certainly the same customer. Similar names, related domains, shared participants, a suggested match, or parent/subsidiary relationships are insufficient. The merge command defaults to preview; execution requires explicit permission, the reviewed preview token, and a stable request ID. Any pair involving an `INDIVIDUAL` requires an eligible saved suggestion.

Read [the identity and merge workflow](https://raw.githubusercontent.com/OutlitAI/skills/e111a4e7c94c5e513e7c77a7e17a003c70d3bba9/skills/outlit/references/identity.md) before previewing, rejecting, executing, retrying, or tracking a merge. It includes the five tool contracts, CLI examples, and asynchronous status handling.

Outlit-owned Churn and Renewal agents receive only the identity diagnostic for their assigned customer. Outlit-owned agents, including the Slack assistant acting for an admin, cannot reject suggestions or execute merges. Do not switch to CLI, API keys, or another identity to bypass an agent's tool policy or permissions. Customer-controlled agents may use the public tools within their granted authority.

## Authorization

Outlit API keys are independent workspace principals. They do not inherit their creator's human permissions or customer access. Key presets are Read only, Personal CLI, Full workspace access, and Custom. Browser onboarding issues a Personal CLI key with read access plus creator-bound integration setup; it does not grant general workspace integration administration.

Current read grants are:

- `customer_intelligence:read`
- `workspace_members:read`
- `analytics:read`
- `activation:read`
- `workspace_settings:read`

Current write or setup grants are:

- `destinations:manage`
- `behavior_metrics:manage`
- `integrations:connect_own`
- `integrations:manage`
- `activation:manage`
- `workspace_settings:manage`
- `customer_access:manage`
- `customer_identity:review`
- `customer_identity:merge`

Identity diagnostics, saved suggestions, merge previews, and merge status require `customer_intelligence:read` for API keys. Rejection requires `customer_identity:review`; execution requires `customer_identity:merge`. The merge grant is excluded from Full workspace access and default presets; an admin must explicitly select it in a Custom key. OAuth MCP inherits the user's current permissions and record access.

A valid key can still receive `403` when it lacks the required grant. Do not retry that failure. Ask a workspace admin to review the key under **Settings > API Keys**. Remote MCP OAuth uses the signed-in user's current workspace authorization instead of an Outlit API key.

## SQL Rules

Call schema before writing SQL.

- Use public analytics views, not backend table names: `activity`, `customers`, `users`, `revenue`.
- Add explicit time filters to activity SQL.
- Use `LIMIT`.
- Divide money fields in cents by `100` for display.
- Inspect JSON or trait column shapes before filtering nested values.
- Keep SQL read-only.

For ClickHouse syntax and query patterns, read [references/sql-reference.md](https://raw.githubusercontent.com/OutlitAI/skills/e111a4e7c94c5e513e7c77a7e17a003c70d3bba9/skills/outlit/references/sql-reference.md).

## CLI Setup

Install the CLI:

```bash
curl -fsSL https://outlit.ai/install.sh | bash
# Alternatives:
npm install -g @outlit/cli
brew install outlitai/tap/outlit
```

Credential resolution order is `--api-key`, `OUTLIT_API_KEY`, then stored credentials.

```bash
outlit onboard --agent <agent> --json
outlit auth login --browser --json
outlit auth status
outlit auth whoami
outlit doctor --json
```

Plain `outlit auth login` automatically selects browser approval in a noninteractive agent shell outside CI. CI requires a key. `outlit setup --yes` and `outlit setup skills` install skills but do not configure MCP clients or integrations.

If `onboard` is unavailable, run `outlit upgrade`, then use `outlit setup <agent>` or `outlit setup skills`.

## CLI Output Behavior

- Interactive terminal: readable tables, spinners, and colors.
- Piped output, `--json`, CI, or `TERM=dumb`: JSON.
- Successful JSON is written to stdout. JSON errors are written to stderr with a nonzero exit status.

Agents should check the exit status and capture stderr instead of assuming every JSON payload is on stdout.

## MCP Setup

Get the workspace URL from **Settings > CLI & MCP**:

```text
https://mcp.outlit.ai/w/<workspace-slug>/mcp
```

Add that URL directly to the MCP client and complete OAuth. Verify the connection with one of the tools actually exposed by the client.

## Pi and Tool Packages

```bash
pi install npm:@outlit/pi
export OUTLIT_API_KEY=ok_your_api_key
pi
```

`@outlit/pi` registers `defaultToolNames` unless a custom policy is supplied. SQL and the broader public catalog are not enabled by default. Use `analyticalToolNames` for the default reads plus SQL, or `piToolNames` for the Pi-supported public catalog only when the agent should receive those capabilities.

For custom TypeScript clients, `@outlit/tools` exports `publicToolContracts`, `publicToolNames`, `consumerToolPolicies`, `defaultToolNames`, `analyticalToolNames`, `piToolNames`, `cliToolNames`, `allPublicToolNames`, and `sqlToolNames`.

## Integrations

Use `setup` to connect or repair a data source; use `status` to inspect readiness. The current CLI exposes two commands:

```text
outlit integrations setup <provider>
outlit integrations status [provider]
```

Interactive `setup` negotiates capabilities first. It can securely prompt for a credential, open a validated browser handoff, or ask the user to confirm a CRM or Mixpanel mapping.

Do not ask the user to paste provider secrets into chat. Do not put secrets in model-visible tool calls, command arguments, logs, shell history, or process listings. When automation must supply provider configuration, have the user run the command in a trusted local terminal and send one strict JSON object through stdin:

```bash
printf '%s\n' '{"credentials":{"apiKey":"<provider-api-key>"}}' \
  | outlit integrations setup fireflies --config-stdin --json
```

Use `--accept-recommended` only to accept the exact CRM recommendation returned by the current setup response. Explicit mappings also go through `--config-stdin`.

JSON mode never prompts, opens a browser, or polls. It returns the setup result, including any handoff or required next step. `status` reports configuration readiness as `not_connected`, `awaiting_auth`, `setup_required`, `ready`, or `requires_intervention`. It does not expose setup-session or synchronization metadata.

Disconnect integrations through the Outlit web app. The CLI does not expose destructive integration removal.

## Troubleshooting

- Missing API key: use `outlit onboard --agent <agent> --json`, `outlit auth login`, or set `OUTLIT_API_KEY`. CI requires a key.
- Valid key but `403`: inspect the key's grants under **Settings > API Keys**.
- Setup issues: run `outlit doctor --json` and `outlit integrations status [provider] --json`.
- Stale CLI or missing current commands: run `outlit upgrade`.
- MCP auth issues: use the workspace URL and OAuth flow. Do not assume remote MCP requires an API key.
- Empty data: inspect integration readiness and data freshness before concluding that a customer has no activity. If communications and usage disagree, check identity coverage too.

## Docs

Start with the [documentation index](https://docs.outlit.ai/llms.txt), then read the relevant pages for your task. The [Outlit docs](https://docs.outlit.ai/) cover the product, CLI, MCP, API, and Outlit SDKs.

## Common Prompts

- "What changed for this customer this week?"
- "Who is paying but inactive for 30 days?"
- "Why does this account need attention?"
- "What pricing objections show up in conversations?"
- "Which Features are customers using before renewal?"
