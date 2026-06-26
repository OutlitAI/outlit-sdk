# @outlit/tools

Customer intelligence tool contracts and API client helpers for Outlit agents.

This package mirrors the public tool gateway contracts used by Outlit CLI, Pi, and agent integrations. The hosted remote MCP server implementation does not live in this repository; discover runtime MCP metadata from the canonical Outlit endpoints below.

Outlit is the real-time understanding of every customer, the infrastructure agents use to automate customer operations.

## Canonical Docs

- Tool gateway API docs: <https://docs.outlit.ai/api-reference/tools>
- API overview: <https://docs.outlit.ai/api-reference/introduction>
- OpenAPI spec: <https://docs.outlit.ai/openapi.json>
- MCP integration docs: <https://docs.outlit.ai/ai-integrations/mcp>
- MCP server metadata: <https://mcp.outlit.ai/.well-known/mcp/server.json>
- MCP server card: <https://mcp.outlit.ai/.well-known/mcp/server-card.json>
- Official MCP Registry listing: <https://registry.modelcontextprotocol.io/v0.1/servers?search=ai.outlit/outlit>
- Agent-facing docs index: <https://docs.outlit.ai/llms.txt>

## When to use this package

Install `@outlit/tools` when you are building a custom agent, server-side integration, or API client that calls the Outlit tool gateway directly and needs typed tool contracts.

Use the hosted remote MCP server instead when you are connecting an MCP client such as Claude Desktop, Cursor, Codex, or another agent runtime. Use `@outlit/cli` for terminal workflows, and use `@outlit/pi` when building Pi agents that need Outlit tool and skill guidance.

```bash
npm install @outlit/tools
```
