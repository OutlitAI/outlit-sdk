import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "merge",
    description: [
      publicToolContracts.outlit_merge_customers.description,
      "",
      "Preview: outlit customers merge <survivorId> <duplicateId> --json",
      "Execute: outlit customers merge <survivorId> <duplicateId> --execute --preview-token <token> --request-id <stableId> --json",
      "Status: outlit customers merge-status <operationId> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    survivorId: { type: "positional", description: "Exact customer ID to retain", required: true },
    duplicateId: { type: "positional", description: "Exact duplicate customer ID", required: true },
    execute: {
      type: "boolean",
      description: "Execute the reviewed merge instead of previewing",
      default: false,
    },
    "preview-token": {
      type: "string",
      description: "Reviewed preview token, required with --execute",
    },
    "request-id": {
      type: "string",
      description: "Stable execution request ID, reuse for identical retries",
    },
    "suggestion-id": {
      type: "string",
      description:
        publicToolContracts.outlit_merge_customers.inputSchema.properties.suggestionId.description,
    },
    "review-notes": { type: "string", description: "Optional explanation for this merge" },
  },
  async run({ args }) {
    const json = !!args.json
    const input: Record<string, unknown> = {
      survivingCustomerId: requiredTrimmedString(args.survivorId, "<survivorId>", json),
      duplicateCustomerId: requiredTrimmedString(args.duplicateId, "<duplicateId>", json),
      dryRun: args.execute !== true,
    }
    if (args.execute === true) {
      input.previewToken = requiredTrimmedString(args["preview-token"], "--preview-token", json)
      input.requestId = requiredTrimmedString(args["request-id"], "--request-id", json)
    }
    const suggestionId = optionalTrimmedString(args["suggestion-id"])
    const reviewNotes = optionalTrimmedString(args["review-notes"])
    if (suggestionId) input.suggestionId = suggestionId
    if (reviewNotes) input.reviewNotes = reviewNotes
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_merge_customers.toolName, input, json)
  },
})
