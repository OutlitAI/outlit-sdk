import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "disable",
    description: [
      "Disable future activation matching for contacts and companies.",
      "",
      "Existing contact and company activation timestamps remain unchanged.",
      "",
      "Examples:",
      "  outlit activation disable --json",
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

    return runTool(client, "outlit_update_customer_activation", { eventName: null }, json, {
      spinnerMessage: "Disabling activation matching...",
    })
  },
})
