# Outlit Pi Agents

This example shows how to build Pi agents with `@outlit/pi`. It includes four customer-signal agents that use Outlit customer intelligence tools, a shared Pi skill, and reusable prompt templates.

These examples focus on harder revenue and retention questions where the agent has to connect product behavior, billing, conversations, support context, timelines, facts, and source evidence.

The prompts are intentionally conservative. A good run may return fewer than 5 accounts when Outlit does not contain enough evidence for the requested signal. That is better than padding a list with adjacent but wrong categories.

## Included Agents

| Agent | Use it for | Pi command | Prompt template |
| --- | --- | --- | --- |
| Usage Decay Churn Watchtower | Paying customers whose product behavior suggests they may cancel soon | `/outlit-usage-decay-watchtower` | `/usage-decay-watchtower` |
| Friction-to-Churn Agent | Accounts where product or support friction is becoming churn risk | `/outlit-friction-to-churn` | `/friction-to-churn` |
| Activation Failure Agent | Trials, new accounts, or recently converted customers that are not reaching first value | `/outlit-activation-failure` | `/activation-failure` |
| Expansion Readiness Agent | Customers likely to upgrade, expand seats, or buy more | `/outlit-expansion-readiness` | `/expansion-readiness` |

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

Set your Outlit API key:

```bash
export OUTLIT_API_KEY=your_outlit_api_key
```

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

Use prompt templates when you want to edit the prompt before sending:

```text
/usage-decay-watchtower paying customers over $500 MRR
/friction-to-churn customers with repeated setup blockers
/activation-failure trials with no payment method
/expansion-readiness active starter-plan customers
```

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

`extensions/outlit-growth-agents.ts` imports `createOutlitPiExtension`, `defaultAgentToolNames`, `actionToolNames`, and `sqlToolNames` from `@outlit/pi`, registers focused customer intelligence, notification action tools, and SQL tools, and adds four slash commands.

The extension does not call Outlit directly. `@outlit/pi` creates Pi tool definitions from `@outlit/tools`, and `@outlit/tools` calls Outlit's public `/api/tools/call` endpoint with your `OUTLIT_API_KEY`.

The example package loads both the shared local `outlit-growth-agents` skill and the generic `outlit` skill from `@outlit/pi`. Pi does not automatically expose resources from dependency packages, so this package references `./node_modules/@outlit/pi/skills` in `package.json`.

`skills/outlit-growth-agents/SKILL.md` gives the model the category boundaries and review playbooks. The `prompts` directory gives users reusable slash prompts.

## Prompt vs Workflow

The Outlit tools are registered when Pi loads this package. Any prompt in that Pi session can use those tools when the model decides they are relevant.

The prompt templates expand into text and start normal agent turns with access to the registered tools.

The extension commands create focused prompts from the command arguments and send those prompts to Pi. They do not run fixed API sequences.

These agents are therefore agentic: the prompt and skill tell the model what evidence to gather, and the model chooses which Outlit tools to call and in what order. If you need a deterministic workflow, create a custom Pi tool or command that calls Outlit APIs directly in the exact sequence you need.

## Tool Scope

These launch examples use the default customer intelligence tools plus SQL/schema tools:

- customer discovery
- user discovery
- customer details
- timeline
- facts
- source lookup
- semantic customer context search
- schema discovery
- SQL query

The base `@outlit/pi` default toolset does not include SQL, but these harder examples opt into notification action tools plus schema and SQL because they benefit from cohorting, revenue filters, usage trends, activation gaps, aggregate checks, and Slack notification support when explicitly requested.

Facts can also be narrowed with `factTypes`. These examples use those filters for extracted customer-memory facts such as `CHURN_RISK`, `EXPANSION`, `SENTIMENT`, `BUDGET`, `REQUIREMENTS`, `PRODUCT_USAGE`, and `CHAMPION_RISK`.

The usage-decay and activation agents do not depend on behavioral/anomaly fact types like `CORE_ACTION_DECAY`, `CADENCE_BREAK`, `QUIET_ACCOUNT`, `ACTIVATION_RATE_DROP`, or `FUNNEL_DROPOFF`. Those fact types are not supported as public filters because many customers will not have configured core actions, activation paths, or funnels. The examples use SQL and customer/user/event evidence as the primary signal for those jobs.

When your installed `@outlit/pi` version includes `analyticalAgentToolNames`, you can use that helper directly instead of combining `defaultAgentToolNames`, `actionToolNames`, and `sqlToolNames` yourself.

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
- Use `factTypes` to narrow facts, but do not request behavioral/anomaly fact types as filters.
- Keep usage decay, product/support friction, activation failure, expansion readiness, and renewal/procurement risk separate.
- Return fewer accounts when the evidence is weak.
- Call out sparse, stale, synthetic, or contradictory data.

Common failure modes to watch for:

- Calling subscription cancellation or renewal friction "usage decay" without product usage evidence.
- Calling legal/procurement negotiation "product friction" without a product, support, implementation, integration, bug, or blocker artifact.
- Calling mature paying churn-risk accounts "activation failures" when they are already past first value.
- Calling high usage, high MRR, or plan mismatch "expansion readiness" without buying intent, plan-limit pain, capacity pressure, seat/team growth, or a premium-feature ask.

## Minimal Agent

If you only want the Outlit tools with no example commands or signal-specific guidance, your extension can be this small:

```ts
import { createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension()
```

That registers the default customer intelligence tools, reads `OUTLIT_API_KEY` from the environment, and uses `https://app.outlit.ai` by default.
