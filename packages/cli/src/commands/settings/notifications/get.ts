import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get Outlit notification settings.",
      "",
      "Examples:",
      "  outlit settings notifications get --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_settings_notifications_get", {}, json, {
      spinnerMessage: "Fetching notification settings...",
    })
  },
})
