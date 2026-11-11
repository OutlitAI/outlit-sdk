import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { optionalTrimmedString, parseCsvList, parseIntegerFlag } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      publicToolContracts.outlit_list_merge_suggestions.description,
      "",
      "Usage: outlit merge-suggestions list --customer <customer> [--include impact,scope,jev,cluster] --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customer: {
      type: "string",
      description: "Only suggestions with this customer (ID, domain or name)",
    },
    "suggestion-id": {
      type: "string",
      description: "Retrieve one exact saved suggestion in the list envelope",
    },
    status: { type: "string", description: "suggested, processing, merged, or rejected" },
    confidence: { type: "string", description: "high, medium, or low" },
    include: {
      type: "string",
      description: "Comma-separated extras: impact, scope, jev, cluster (default: none)",
    },
    cursor: { type: "string", description: "Continuation cursor from the previous response" },
    limit: { type: "string", description: "Maximum results (1-100, default 25)" },
  },
  async run({ args }) {
    const json = !!args.json
    const input: Record<string, unknown> = {
      limit: parseIntegerFlag(args.limit, 25, "--limit", json),
    }
    const filters: Record<string, string> = {}
    const customer = optionalTrimmedString(args.customer)
    const cursor = optionalTrimmedString(args.cursor)
    const include = parseCsvList(args.include).map((value) => value.toLowerCase())
    if (customer) input.customer = customer
    if (cursor) input.cursor = cursor
    if (include.length > 0) input.include = include
    // Enum values are lowercase on the wire; the uppercase spelling the CLI used to advertise still works.
    for (const [flag, field, lower] of [
      ["suggestion-id", "id", false],
      ["status", "status", true],
      ["confidence", "confidence", true],
    ] as const) {
      const value = optionalTrimmedString(args[flag])
      if (value) filters[field] = lower ? value.toLowerCase() : value
    }
    if (Object.keys(filters).length > 0) input.filters = filters
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_list_merge_suggestions.toolName, input, json)
  },
})
