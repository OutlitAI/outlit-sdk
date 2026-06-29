import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

function parseDestinationType(type: string | undefined, json: boolean): "WEBHOOK_ENDPOINT" {
  const normalized = optionalTrimmedString(type)?.toLowerCase()
  if (normalized === "webhook" || normalized === "webhook_endpoint") {
    return "WEBHOOK_ENDPOINT"
  }

  return outputError(
    { message: "--type must be webhook", code: normalized ? "invalid_input" : "missing_input" },
    json,
  )
}

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create an Outlit automation destination.",
      "",
      "Examples:",
      "  outlit destinations create --type webhook --name 'Customer ops' --url https://hooks.example.com/outlit --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    type: { type: "string", description: "Destination type. Currently supports: webhook" },
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
      "outlit_destination_create",
      {
        type: parseDestinationType(args.type, json),
        name: requiredTrimmedString(args.name, "--name", json),
        description: optionalTrimmedString(args.description),
        enabled: !args.disabled,
        url: requiredTrimmedString(args.url, "--url", json),
      },
      json,
      { spinnerMessage: "Creating destination..." },
    )
  },
})
