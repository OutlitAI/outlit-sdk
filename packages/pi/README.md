# @outlit/pi

Pi package for Outlit customer intelligence tools.

## Install

```bash
pi install npm:@outlit/pi
```

Set an Outlit API key before starting Pi:

```bash
export OUTLIT_API_KEY=ok_...
pi
```

Use `OUTLIT_API_URL` to point the tools at a non-production Outlit environment:

```bash
export OUTLIT_API_URL=https://staging.app.outlit.ai
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
- `outlit_search_customer_context`

SQL tools are available from `@outlit/tools`, but they are not enabled by default. Integration-management commands are intentionally not part of this package.

## Skill

This package also ships an `outlit` Pi skill. Pi loads the skill when you install `@outlit/pi` as a Pi package:

```bash
pi install npm:@outlit/pi
```

The skill gives the model generic guidance for choosing between customer records, users, timelines, facts, search, sources, and SQL when SQL tools are enabled. It does not add CLI or MCP instructions; it assumes the Outlit tools registered by this package are the available interface.

## Custom Toolsets

Create a small Pi extension when you want a narrower or broader toolset:

```ts
import { allCustomerToolNames, createOutlitPiExtension } from "@outlit/pi"

export default createOutlitPiExtension({
  toolNames: allCustomerToolNames,
})
```

You can also pass `apiKey`, `baseUrl`, and `fetch` directly to `createOutlitPiExtension` for embedded or test environments.

See [`examples/pi-agents`](../../examples/pi-agents) for a complete churn-review Pi agent built on this package.
