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

The default extension registers the default customer intelligence tools from `@outlit/tools`:

- `outlit_list_customers`
- `outlit_list_users`
- `outlit_get_customer`
- `outlit_get_timeline`
- `outlit_list_facts`
- `outlit_get_fact`
- `outlit_get_source`
- `outlit_list_sources`
- `outlit_search_customer_context`

SQL and the other Pi-supported Platform capabilities are available from `@outlit/tools`, but the default Pi policy intentionally stays focused on customer intelligence. A custom Pi extension can opt into every Pi-supported tool with `piToolNames`, including customer ownership and access, safe integration setup, destination, activation, and workspace-settings actions. Behavior Metric source discovery, event discovery, and creation, along with other internal commands, are not available through Pi.

For analytical agents that need cohorts, usage trends, revenue filters, activation gaps, or aggregate checks, import `analyticalToolNames`. It combines the default customer intelligence tools with `outlit_schema` and `outlit_query` without exposing every customer tool:

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

The facts tool supports `factTypes` filters for narrowing structured customer-memory evidence. Anomaly detector fact types are not supported as public filters because customers may not have configured core actions, activation paths, or funnels.

## Custom Toolsets

Create a small Pi extension when you want a narrower or broader toolset:

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
