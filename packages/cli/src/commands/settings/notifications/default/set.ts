import { defineCommand } from "citty"
import { authArgs } from "../../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../../args/output"
import { getClientOrExit, runTool } from "../../../../lib/api"
import { requiredTrimmedString } from "../../../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "set",
    description: [
      "Set the default Outlit notification destination.",
      "",
      "Examples:",
      "  outlit settings notifications default set --destination-id 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "destination-id": {
      type: "string",
      description: "Destination ID to use as the default notification destination",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const destinationId = requiredTrimmedString(args["destination-id"], "--destination-id", json)

    return runTool(client, "outlit_settings_notifications_default_set", { destinationId }, json, {
      spinnerMessage: "Setting default notification destination...",
    })
  },
})
