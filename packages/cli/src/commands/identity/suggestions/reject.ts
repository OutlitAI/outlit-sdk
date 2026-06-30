import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"

export default defineCommand({
  meta: {
    name: "reject",
    description: [
      "Reject one suggested customer identity merge.",
      "",
      "Examples:",
      "  outlit identity suggestions reject 10000000-0000-4000-8000-000000000001 --json",
      "  outlit identity suggestions reject 10000000-0000-4000-8000-000000000001 --review-notes 'Not a duplicate' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Identity merge suggestion ID",
      required: true,
    },
    "review-notes": {
      type: "string",
      description: "Optional review notes to attach to the rejected suggestion",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = { id: args.id }

    if (args["review-notes"]) {
      params.reviewNotes = args["review-notes"]
    }

    return runTool(client, "outlit_identity_merge_suggestion_reject", params, json, {
      spinnerMessage: "Rejecting identity merge suggestion...",
    })
  },
})
