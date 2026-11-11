import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "reject",
    description: [
      publicToolContracts.outlit_reject_merge_suggestion.description,
      "",
      "Usage: outlit merge-suggestions reject <id> --note 'Different companies' [--request-id <stableId>] --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Exact saved suggestion ID", required: true },
    note: { type: "string", description: "Optional reason for rejection" },
    "request-id": {
      type: "string",
      description: "Stable request ID, reuse for identical retries (default: a new one per run)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const suggestionId = requiredTrimmedString(args.id, "<id>", json)
    const note = optionalTrimmedString(args.note)
    const requestId = optionalTrimmedString(args["request-id"]) ?? crypto.randomUUID()
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_reject_merge_suggestion.toolName,
      { id: suggestionId, ...(note ? { note } : {}), requestId },
      json,
    )
  },
})
