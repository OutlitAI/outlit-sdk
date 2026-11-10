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
      "Status: outlit customers merge-status <operationId> --json (the operation.id from execute)",
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
      description: "preview.token from the preview, required with --execute",
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
    "review-notes": {
      type: "string",
      description: "Optional explanation for this merge (execute only)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const execute = args.execute === true
    const input: Record<string, unknown> = {
      mode: execute ? "execute" : "preview",
      survivor: requiredTrimmedString(args.survivorId, "<survivorId>", json),
      duplicate: requiredTrimmedString(args.duplicateId, "<duplicateId>", json),
    }
    if (execute) {
      input.previewToken = requiredTrimmedString(args["preview-token"], "--preview-token", json)
      input.requestId = requiredTrimmedString(args["request-id"], "--request-id", json)
    }
    const suggestionId = optionalTrimmedString(args["suggestion-id"])
    const note = optionalTrimmedString(args["review-notes"])
    if (suggestionId) input.suggestionId = suggestionId
    if (execute && note) input.note = note
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_merge_customers.toolName, input, json)
  },
})
