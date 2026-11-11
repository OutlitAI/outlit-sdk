import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import {
  optionalTrimmedString,
  parseBooleanFlag,
  requiredTrimmedString,
} from "../../lib/platform-input"
import { newRequestId } from "../../lib/request-id"

function parseDestinationType(type: string | undefined, json: boolean): "slack_channel" {
  const normalized = optionalTrimmedString(type)?.toLowerCase()
  if (normalized === "slack" || normalized === "slack_channel") {
    return "slack_channel"
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
      "  outlit destinations create --type slack --channel-id C0123456789 --label '#customer-ops' --is-default --json",
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
    "is-default": { type: "boolean", description: "Make this the default destination" },
    enabled: {
      type: "string",
      description: "true (default) or false: create the destination enabled or disabled",
    },
    "request-id": {
      type: "string",
      description: "Stable retry key: the same id returns the first result (default: a new one)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const isDefault = args["is-default"] === true
    const enabled = parseBooleanFlag(args.enabled, "--enabled", json) ?? true
    if (isDefault && !enabled) {
      return outputError(
        { message: "A default destination cannot be disabled", code: "invalid_input" },
        json,
      )
    }

    return runTool(
      client,
      "outlit_create_destination",
      {
        type: parseDestinationType(args.type, json),
        channelId: requiredTrimmedString(args["channel-id"], "--channel-id", json),
        label: requiredTrimmedString(args.label, "--label", json),
        enabled,
        isDefault,
        requestId: optionalTrimmedString(args["request-id"]) ?? newRequestId(),
      },
      json,
      { spinnerMessage: "Creating destination..." },
    )
  },
})
