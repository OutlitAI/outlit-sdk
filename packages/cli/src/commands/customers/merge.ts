import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "merge",
    description: [
      publicToolContracts.outlit_merge_customers.description,
      "",
      "Preview: outlit customers merge <survivor> <duplicate> --json",
      "Execute: outlit customers merge <survivor> <duplicate> --mode execute --preview-token <token> --idempotency-key <stableId> --json",
      "Status: outlit merges get <id> --json (the operation.id from execute)",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    survivor: { type: "positional", description: "Exact customer ID to retain", required: true },
    duplicate: { type: "positional", description: "Exact duplicate customer ID", required: true },
    mode: {
      type: "string",
      description: "preview (default) or execute the reviewed merge",
    },
    "preview-token": {
      type: "string",
      description: "preview.token from the preview, required with --mode execute",
    },
    "idempotency-key": {
      type: "string",
      description: "Idempotency key, reuse it for identical retries",
    },
    "suggestion-id": {
      type: "string",
      description:
        publicToolContracts.outlit_merge_customers.inputSchema.properties.suggestionId.description,
    },
    note: {
      type: "string",
      description: "Optional explanation for this merge (execute only)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const mode = (optionalTrimmedString(args.mode) ?? "preview").toLowerCase()
    if (mode !== "preview" && mode !== "execute") {
      return outputError(
        { message: "--mode must be preview or execute", code: "invalid_input" },
        json,
      )
    }
    const execute = mode === "execute"
    const input: Record<string, unknown> = {
      mode,
      survivor: requiredTrimmedString(args.survivor, "<survivor>", json),
      duplicate: requiredTrimmedString(args.duplicate, "<duplicate>", json),
    }
    if (execute) {
      input.previewToken = requiredTrimmedString(args["preview-token"], "--preview-token", json)
      input.idempotencyKey = requiredTrimmedString(
        args["idempotency-key"],
        "--idempotency-key",
        json,
      )
    }
    const suggestionId = optionalTrimmedString(args["suggestion-id"])
    const note = optionalTrimmedString(args.note)
    if (suggestionId) input.suggestionId = suggestionId
    if (execute && note) input.note = note
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_merge_customers.toolName, input, json)
  },
})
