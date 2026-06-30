import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"

export default defineCommand({
  meta: {
    name: "queue",
    description: [
      "Queue one suggested customer identity merge for asynchronous processing.",
      "",
      "Examples:",
      "  outlit identity suggestions queue 10000000-0000-4000-8000-000000000001 --json",
      "  outlit identity suggestions queue 10000000-0000-4000-8000-000000000001 --review-notes 'Verified duplicate' --json",
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
      description: "Optional review notes to attach to the merge suggestion",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = { id: args.id }

    if (args["review-notes"]) {
      params.reviewNotes = args["review-notes"]
    }

    return runTool(client, "outlit_identity_merge_suggestion_queue", params, json, {
      spinnerMessage: "Queueing identity merge suggestion...",
    })
  },
})
