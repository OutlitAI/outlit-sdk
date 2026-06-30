import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

function parseDestinationType(type: string | undefined, json: boolean): "SLACK_CHANNEL" {
  const normalized = optionalTrimmedString(type)?.toLowerCase()
  if (normalized === "slack" || normalized === "slack_channel") {
    return "SLACK_CHANNEL"
  }

  return outputError(
    { message: "--type must be slack", code: normalized ? "invalid_input" : "missing_input" },
    json,
  )
}

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create an Outlit Slack channel destination.",
      "",
      "Examples:",
      "  outlit destinations create --type slack --channel-id C0123456789 --label '#customer-ops' --json",
      "  outlit destinations create --type slack --channel-id C0123456789 --label '#customer-ops' --default --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    type: { type: "string", description: "Destination type. Currently supports: slack" },
    "channel-id": { type: "string", description: "Slack channel ID" },
    label: { type: "string", description: "Slack channel label" },
    default: { type: "boolean", description: "Make this the default destination" },
    disabled: { type: "boolean", description: "Create the destination disabled" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    if (args.default === true && args.disabled === true) {
      return outputError(
        { message: "Use either --default or --disabled, not both", code: "invalid_input" },
        json,
      )
    }

    return runTool(
      client,
      "outlit_destination_create",
      {
        type: parseDestinationType(args.type, json),
        channelId: requiredTrimmedString(args["channel-id"], "--channel-id", json),
        label: requiredTrimmedString(args.label, "--label", json),
        enabled: args.default === true ? true : !args.disabled,
        isDefault: args.default === true,
      },
      json,
      { spinnerMessage: "Creating destination..." },
    )
  },
})
