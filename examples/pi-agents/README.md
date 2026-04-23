# Outlit Pi Agents

This example shows how to build Pi agents with `@outlit/pi`. It includes four customer-signal agents that use Outlit customer intelligence tools, SQL/schema tools, Slack notification actions, a shared Pi skill, and reusable prompt templates for the fully agentic examples.

These examples focus on harder revenue and retention questions where the agent has to connect product behavior, billing, conversations, support context, timelines, facts, and source evidence.

The prompts are intentionally conservative. A good run may return fewer than 5 accounts when Outlit does not contain enough evidence for the requested signal. That is better than padding a list with adjacent but wrong categories.

## Included Agents

| Agent | Use it for | Pi command | Prompt template |
| --- | --- | --- | --- |
| Usage Decay Churn Watchtower | Paying customers whose product behavior suggests they may cancel soon | `/outlit-usage-decay-watchtower` | Use the command |
| Friction-to-Churn Agent | Accounts where product or support friction is becoming churn risk | `/outlit-friction-to-churn` | `/friction-to-churn` |
| Activation Failure Agent | Trials, new accounts, or recently converted customers that are not reaching first value | `/outlit-activation-failure` | `/activation-failure` |
| Expansion Readiness Agent | Customers likely to upgrade, expand seats, or buy more | `/outlit-expansion-readiness` | `/expansion-readiness` |

The usage-decay command runs deterministic churn pretriage before the model starts. It reads `churn.json`, surfaces customers that match the configured usage, billing, and user-inactivity thresholds, and then asks Pi to review only those customers with the rest of the Outlit tools.

The activation-failure command also runs deterministic pretriage before the model starts. It checks user journey stages and normalized activation events, then asks Pi to review the surfaced accounts with customer, timeline, fact, source, and search tools.

After evidence review, each command asks Pi to call the Slack notification tool once with a JSON-compatible `payload` object, then return the same findings in chat. Usage decay and activation failure use deterministic pretriage for candidate discovery, then follow the same notification-first workflow as the other growth agents.

By default, the command includes 5 surfaced customers in the prompt. If more customers match, the pretriage helper rotates to the next page of customers every hour within the same risk bucket so scheduled runs do not keep reviewing the same 5 unchanged accounts. You can tune that cadence with `promptSelection.rotationWindowHours` in `churn.json`.

Rotation is slot-based. With `maxPromptCustomers: 5`, the first hourly slot gets sorted candidates 1-5, the next slot gets 6-10, and so on. It wraps when it reaches the end. Re-running in the same slot returns the same page so the run is reproducible.

## Setup

Install Pi if you do not already have it:

```bash
npm install -g @mariozechner/pi-coding-agent
```

Install this example package's dependencies:

```bash
cd examples/pi-agents
npm install
```

This example uses the `canary` dist-tag for `@outlit/pi` and `@outlit/tools` while the Pi agent package is still moving quickly.

Set your Outlit API key:

```bash
export OUTLIT_API_KEY=your_outlit_api_key
```

Slack notification tools are part of the default workflow for these growth agents. Each command instructs Pi to call `outlit_send_notification` after evidence review and to put structured JSON-compatible data in the notification `payload` field.

To try the agents from this example directory:

```bash
pi install -l .
pi
```

To use the agents in one of your own projects, run the install command from that project instead:

```bash
cd /path/to/your/project
pi install -l /path/to/outlit-sdk/examples/pi-agents
pi
```

## Running The Agents

Use a slash command with a specific scope:

```text
/outlit-usage-decay-watchtower paying customers over $500 MRR
/outlit-friction-to-churn customers with integration complaints
/outlit-activation-failure trial accounts from the last 30 days
/outlit-expansion-readiness starter-plan customers
```

Use a command without arguments for a portfolio scan:

```text
/outlit-usage-decay-watchtower
```

For a friction-to-churn demo that sends Slack after evidence review:

```bash
OUTLIT_API_KEY=your_outlit_api_key pi -p '/outlit-friction-to-churn Atlas Assist. Find actionable churn risk, cite source evidence, and send the Slack notification.'
```

Use prompt templates for the fully agentic examples when you want to edit the prompt before sending:

```text
/friction-to-churn customers with repeated setup blockers
/activation-failure trials with no payment method
/expansion-readiness active starter-plan customers
```

Usage decay is intentionally command-only because `/outlit-usage-decay-watchtower` runs deterministic pretriage before the model starts. Activation failure has both options: the `/outlit-activation-failure` command includes deterministic pretriage, while `/activation-failure` is a fully agentic prompt template.

Free-form requests also work because the package includes a shared skill:

```text
Which paying customers are active enough to be expansion candidates but blocked by plan limits?
```

## Claude Code Prompts

The `claude-code-prompts` directory contains copyable long prompts for running the same jobs in Claude Code with the Outlit CLI:

- `claude-code-prompts/usage-decay-watchtower.md`
- `claude-code-prompts/friction-to-churn.md`
- `claude-code-prompts/activation-failure.md`
- `claude-code-prompts/expansion-readiness.md`

Those prompts assume the `outlit` CLI is on `PATH` and authenticated through environment variables. They intentionally tell Claude Code to use Outlit data only, not local seed files or repository artifacts.

## How It Works

`extensions/outlit-growth-agents.ts` imports `createOutlitPiExtension` and `analyticalAgentToolNames` from `@outlit/pi`, registers customer intelligence, SQL tools, Slack notification actions, and four slash commands.

The extension also registers local deterministic helpers from `lib/churn-pretriage.ts` and `lib/activation-pretriage.ts`. The `/outlit-usage-decay-watchtower` and `/outlit-activation-failure` commands call those helpers before sending the model prompt. Free-form Pi prompts can call the helpers too when the model decides deterministic candidate discovery is useful.

Most tools are created by `@outlit/pi` from `@outlit/tools`, and `@outlit/tools` calls Outlit's public `/api/tools/call` endpoint with your `OUTLIT_API_KEY`. The local pretriage helpers use the same public `outlit_query` tool internally, so they stay on the public tool gateway rather than reaching into private Outlit services.

The example package loads both the shared local `outlit-growth-agents` skill and the generic `outlit` skill from `@outlit/pi`. Pi does not automatically expose resources from dependency packages, so this package references `./node_modules/@outlit/pi/skills` in `package.json`.

`skills/outlit-growth-agents/SKILL.md` gives the model the category boundaries and review playbooks. The `prompts` directory gives users reusable slash prompts for the fully agentic examples.

## Prompt vs Workflow

The Outlit tools are registered when Pi loads this package. Any prompt in that Pi session can use those tools when the model decides they are relevant.

The prompt templates expand into text and start normal agent turns with access to the registered tools. Usage decay is not exposed as a prompt template because its deterministic pretriage pass is part of the workflow.

The extension commands create focused prompts from the command arguments and send those prompts to Pi. They do not run fixed API sequences.

Most agents here are agentic: the prompt and skill tell the model what evidence to gather, and the model chooses which Outlit tools to call and in what order.

The usage-decay and activation-failure commands are the exceptions only in how candidates are discovered. They run deterministic pretriage first, then give Pi the surfaced customer list as review context. After the model finishes evidence review, it calls `outlit_send_notification` with a structured JSON-compatible `payload` object and then returns the findings in chat. This mirrors the internal agent pattern: deterministic candidate discovery first, LLM evidence review second, Slack notification last.

## Churn Pretriage Config

`churn.json` controls the deterministic usage-decay pass. The default config mirrors the internal churn-agent thresholds:

- ignore noisy/passive events like `$identify`, `$pageleave`, `$web_vitals`, `$autocapture`, and similar background telemetry
- surface `PAST_DUE` customers as likely churn
- surface customers with 14, 30, or 120 days since last meaningful activity
- surface mature customers with 4 or fewer meaningful active days in the last 30 days
- surface customers with a 50% active-day drop versus the prior baseline
- surface users who were previously active and are now stale for 7 or 14 days
- surface accounts where all recently active users are now inactive

Edit this file when your product has a clearer definition of meaningful activity. The include/exclude lists match against the public `activity.event_name` value. For example, set `activityDefinition.includeEventNames` to your core activation or workflow events when you want the agent to ignore all other events.

## Activation Pretriage

`/outlit-activation-failure` uses `outlit_activation_pretriage` before the model starts. The helper scans trialing, unpaid, and early paying accounts by default, then surfaces accounts that have observed users but no activated or engaged users and no normalized activation event.

The SDK activation helpers emit stage events with `eventName: "activated"` so activation queries can use one normalized event name. The pretriage helper also recognizes legacy `stage:activated` events for older ingest pipelines.

## Tool Scope

These launch examples use the default customer intelligence tools plus SQL/schema and Slack notification tools:

- customer discovery
- user discovery
- customer details
- timeline
- facts
- source lookup
- semantic customer context search
- schema discovery
- SQL query
- Slack notification

The base `@outlit/pi` default toolset does not include SQL, but these harder examples use `analyticalAgentToolNames` to opt into schema and SQL because they benefit from cohorting, revenue filters, usage trends, activation gaps, and aggregate checks. The analytical toolset also includes Slack notification actions; the skill and command prompts tell the model to call `outlit_send_notification` by default after evidence review.

Facts can also be narrowed with `factTypes`. These examples use those filters for extracted customer-memory facts such as `CHURN_RISK`, `EXPANSION`, `SENTIMENT`, `BUDGET`, `REQUIREMENTS`, `PRODUCT_USAGE`, and `CHAMPION_RISK`.

The usage-decay and activation agents do not depend on behavioral/anomaly fact types like `CORE_ACTION_DECAY`, `CADENCE_BREAK`, `QUIET_ACCOUNT`, `ACTIVATION_RATE_DROP`, or `FUNNEL_DROPOFF`. Those fact types are not supported as public filters because many customers will not have configured core actions, activation paths, or funnels. The examples use SQL and customer/user/event evidence as the primary signal for those jobs.

`@outlit/pi` also exports narrower tool lists, such as `defaultAgentToolNames`, `sqlToolNames`, and `actionToolNames`, when you want to assemble a custom toolset.

The examples still avoid `allCustomerToolNames` because broad tool access can make agents over-weight high-revenue accounts with weak evidence. Use broader toolsets only when you intentionally want internal analysis or custom reporting.

For example:

```ts
import { allCustomerToolNames, createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension({
  toolNames: allCustomerToolNames,
})
```

Keep integration setup or integration-management actions outside customer-facing Pi agents unless you are intentionally building an internal admin package. Customer-facing agents should usually read customer intelligence, not modify integration configuration.

## Quality Bar

Treat these agents as evidence reviewers, not label generators. They should:

- Use domains or stable customer IDs for follow-up lookups when names are ambiguous.
- Use SQL/schema for candidate discovery, then customer, timeline, fact, source, and search tools for account-level evidence.
- Use `outlit_send_notification` by default after evidence review for these growth-agent commands.
- Put a JSON-compatible object in the notification `payload` field, not a JSON string, markdown table, code fence, or prose blob.
- Use `factTypes` to narrow facts, but do not request behavioral/anomaly fact types as filters.
- Keep usage decay, product/support friction, activation failure, expansion readiness, and renewal/procurement risk separate.
- Return fewer accounts when the evidence is weak.
- Account for reviewed, ranked, and excluded candidates instead of padding a top-5 list.
- Include concrete evidence, confidence, recommended action, and missing data for each ranked customer.
- Call out sparse, stale, synthetic, or contradictory data.

Common failure modes to watch for:

- Calling subscription cancellation or renewal friction "usage decay" without product usage evidence.
- Calling legal/procurement negotiation "product friction" without a product, support, implementation, integration, bug, or blocker artifact.
- Calling mature paying churn-risk accounts "activation failures" when they are already past first value.
- Calling high usage, high MRR, or plan mismatch "expansion readiness" without buying intent, plan-limit pain, capacity pressure, seat/team growth, or a premium-feature ask.

## Minimal Agent

If you only want the default `@outlit/pi` tools with no example commands or signal-specific guidance, your extension can be this small:

```ts
import { createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension()
```

That registers the default `@outlit/pi` toolset, including notification actions. It reads `OUTLIT_API_KEY` from the environment and uses `https://app.outlit.ai` by default.
