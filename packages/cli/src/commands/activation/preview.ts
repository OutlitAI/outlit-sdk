import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import {
  activationEventArg,
  activationPreviewArgs,
  parseActivationEvent,
  parseActivationPreviewOptions,
} from "../../lib/activation"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "preview",
    description: [
      "Preview separate impact counts for contacts and companies from one exact product event.",
      "",
      "Preview is read-only: it never saves the event setting or materializes activation.",
      "",
      "Examples:",
      "  outlit activation preview --event integration_connected --json",
      "  outlit activation preview --event integration_connected --lookback-days 60 --example-limit 20 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...activationEventArg,
    ...activationPreviewArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const eventName = parseActivationEvent(args, json)
    const options = parseActivationPreviewOptions(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_preview_customer_activation", { eventName, ...options }, json, {
      spinnerMessage: "Previewing activation matches...",
    })
  },
})
