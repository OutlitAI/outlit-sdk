import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"
import { optionalTrimmedString, parseIntegerFlag } from "../../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      publicToolContracts.outlit_list_identity_merge_suggestions.description,
      "",
      "Usage: outlit identity suggestions list --customer-id <id> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "customer-id": { type: "string", description: "Filter by exact customer ID" },
    "suggestion-id": {
      type: "string",
      description: "Retrieve one exact saved suggestion in the list envelope",
    },
    status: { type: "string", description: "suggested, processing, merged, or rejected" },
    confidence: { type: "string", description: "HIGH, MEDIUM, or LOW" },
    cursor: { type: "string", description: "Continuation cursor from the previous response" },
    limit: { type: "string", description: "Maximum results (1-100, default 50)" },
  },
  async run({ args }) {
    const json = !!args.json
    const input: Record<string, unknown> = {
      limit: parseIntegerFlag(args.limit, 50, "--limit", json),
    }
    for (const [flag, field] of [
      ["customer-id", "customerId"],
      ["suggestion-id", "suggestionId"],
      ["status", "status"],
      ["confidence", "confidence"],
      ["cursor", "cursor"],
    ] as const) {
      const value = optionalTrimmedString(args[flag])
      if (value) input[field] = value
    }
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_list_identity_merge_suggestions.toolName,
      input,
      json,
    )
  },
})
