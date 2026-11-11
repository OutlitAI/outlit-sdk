import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      publicToolContracts.outlit_get_setup_session.description,
      "",
      "Example:",
      "  outlit setup-sessions get 5b0e2f3a-6c1d-4e8a-9a3b-0c9d8e7f6a5b --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "The session id from a browser_handoff step",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const id = requiredTrimmedString(args.id, "<id>", json)
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_get_setup_session.toolName, { id }, json, {
      spinnerMessage: "Checking the setup session...",
    })
  },
})
