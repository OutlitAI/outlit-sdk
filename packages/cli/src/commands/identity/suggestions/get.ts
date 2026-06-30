import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one customer identity merge suggestion by id.",
      "",
      "Examples:",
      "  outlit identity suggestions get 10000000-0000-4000-8000-000000000001 --json",
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
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_identity_merge_suggestion_get", { id: args.id }, json, {
      spinnerMessage: "Fetching identity merge suggestion...",
    })
  },
})
