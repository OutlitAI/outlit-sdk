import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"
import { optionalTrimmedString, requiredTrimmedString } from "../../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "reject",
    description: [
      publicToolContracts.outlit_reject_identity_merge_suggestion.description,
      "",
      "Usage: outlit identity suggestions reject <suggestionId> --review-notes 'Different companies' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    suggestionId: { type: "positional", description: "Exact saved suggestion ID", required: true },
    "review-notes": { type: "string", description: "Optional reason for rejection" },
  },
  async run({ args }) {
    const json = !!args.json
    const suggestionId = requiredTrimmedString(args.suggestionId, "<suggestionId>", json)
    const reviewNotes = optionalTrimmedString(args["review-notes"])
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_reject_identity_merge_suggestion.toolName,
      { suggestionId, ...(reviewNotes ? { reviewNotes } : {}) },
      json,
    )
  },
})
