# @outlit/pi

Pi package for Outlit customer intelligence tools.

Outlit is the real-time understanding of every customer, the infrastructure agents use to automate customer operations.

## Install

```bash
pi install npm:@outlit/pi
```

Set an Outlit API key before starting Pi:

```bash
export OUTLIT_API_KEY=ok_...
pi
```

## Tools

The default extension registers the default customer intelligence tools from `@outlit/tools`, plus the two read-only toolset tools (`piDefaultToolNames`):

- `outlit_list_customers`
- `outlit_list_customer_fields`
- `outlit_list_people`
- `outlit_get_customer`
- `outlit_get_timeline`
- `outlit_list_facts`
- `outlit_get_fact`
- `outlit_get_source`
- `outlit_list_sources`
- `outlit_search_customer_context`
- `outlit_list_toolsets`
- `outlit_load_toolset`

Pi registers its tools when a session starts, so `outlit_list_toolsets` and `outlit_load_toolset` tell the agent which toolset holds a tool it lacks; enabling that toolset is the extension's `toolsets` option (below).

SQL and the other Pi-supported Platform capabilities are available from `@outlit/tools`, but the default Pi policy intentionally stays focused on customer intelligence. A custom Pi extension can opt into every Pi-supported tool with `piToolNames`, including task reads and actions, customer ownership and access actions, product-facing Feature list, create and archive tools, plus safe integration setup, destination, activation, workspace-settings actions, and `outlit_submit_feedback` product feedback intake. The analytical policy (`analyticalToolNames`) is unchanged and does not include the toolset tools.

For analytical agents that need cohorts, usage trends, revenue filters, activation gaps, or aggregate checks, import `analyticalToolNames`. It combines the default customer intelligence tools with `outlit_get_schema` and `outlit_query` without exposing every customer tool:

```ts
import { analyticalToolNames, createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension({
  toolNames: analyticalToolNames,
})
```

## Skill

This package also ships an `outlit` Pi skill. Pi loads the skill when you install `@outlit/pi` as a Pi package:

```bash
pi install npm:@outlit/pi
```

The skill gives the model generic guidance for choosing between customer records, users, timelines, facts, search, sources, and SQL when SQL tools are enabled. It does not add CLI or MCP instructions; it assumes the Outlit tools registered by this package are the available interface.

The facts tool supports `filters.types` for narrowing structured evidence (all filter values are lowercase). Public filters include customer-memory facts and relationship transitions such as `contact_departure`, `contact_position_change`, and `contact_disengagement`. Anomaly detector fact types are not supported as public filters because customers may not have configured core actions, activation paths, or funnels.

## Custom Toolsets

Create a small Pi extension when you want a narrower or broader toolset. Core groups its tools into toolsets (`core`, `work`, `identity`, `admin`, `meta`); `toolsets` registers every tool in the ones you name, and combines with `toolNames` when you pass both:

```ts
import { createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension({
  toolsets: ["core", "work"],
})
```

A call that fails (a gateway error, a rate limit, a dropped connection) is returned as the tool result `{ "error": { code, message, retryable, requestId, next, missingPermission, validationIssues, retryAfterSeconds } }`, with the fields the gateway sent, so the agent can fix its input, wait or report the missing permission. `details.error` holds the same object. A missing API key or non-object input still throws.

A tool result that comes with a deprecation or an input notice from Outlit (for example a limit lowered to the maximum) carries it as a second text block after the JSON.

To register every Pi-supported tool:

```ts
import { createOutlitPiExtension, piToolNames } from "@outlit/pi"

export default createOutlitPiExtension({
  toolNames: piToolNames,
})
```

You can also pass `apiKey`, `baseUrl`, and `fetch` directly to `createOutlitPiExtension` for embedded or test environments.

See [`examples/pi-agents`](../../examples/pi-agents) for complete customer-signal Pi agents built on this package, including usage-decay churn, friction-to-churn, activation-failure, and expansion-readiness examples.

## Canonical Docs

- Pi agents: <https://docs.outlit.ai/ai-integrations/pi>
- Tool gateway API docs: <https://docs.outlit.ai/api-reference/tools>
- Agent skills: <https://docs.outlit.ai/ai-integrations/skills>
- MCP integration for remote MCP clients: <https://docs.outlit.ai/ai-integrations/mcp>
- Agent-facing docs index: <https://docs.outlit.ai/llms.txt>
