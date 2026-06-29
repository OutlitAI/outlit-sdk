import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "create-webhook",
    description: [
      "Create an Outlit webhook destination.",
      "",
      "Examples:",
      "  outlit destinations create-webhook --name 'Customer ops' --url https://hooks.example.com/outlit --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    name: { type: "string", description: "Destination name" },
    url: { type: "string", description: "Webhook URL" },
    description: { type: "string", description: "Optional destination description" },
    disabled: { type: "boolean", description: "Create the destination disabled" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_destination_create_webhook",
      {
        type: "WEBHOOK_ENDPOINT",
        name: requiredTrimmedString(args.name, "--name", json),
        description: optionalTrimmedString(args.description),
        enabled: !args.disabled,
        url: requiredTrimmedString(args.url, "--url", json),
      },
      json,
      { spinnerMessage: "Creating webhook destination..." },
    )
  },
})
