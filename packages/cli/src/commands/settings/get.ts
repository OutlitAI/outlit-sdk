import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get Outlit workspace settings: the default timezone and customer owner, and the activation event.",
      "Use the returned revision with `outlit settings update --revision`.",
      "",
      "Examples:",
      "  outlit settings get --json",
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

    return runTool(client, "outlit_get_settings", {}, json, {
      spinnerMessage: "Fetching settings...",
    })
  },
})
