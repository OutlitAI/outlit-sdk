import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { activationEventArg, parseActivationEvent } from "../../lib/activation"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update the exact ordinary product event used for monotonic activation.",
      "",
      "Core applies the first matching product event to eligible contacts and their resolved",
      "company. Applications keep sending ordinary events; the CLI does not activate subjects.",
      "",
      "Examples:",
      "  outlit activation update --event integration_connected --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...activationEventArg,
  },
  async run({ args }) {
    const json = !!args.json
    const eventName = parseActivationEvent(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_update_customer_activation", { eventName }, json, {
      spinnerMessage: "Updating activation event...",
    })
  },
})
