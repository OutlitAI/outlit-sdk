import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

function parseDestinationType(type: string, json: boolean): "SLACK_CHANNEL" {
  const normalized = type.trim().toLowerCase()
  if (normalized === "slack" || normalized === "slack_channel") {
    return "SLACK_CHANNEL"
  }

  return outputError({ message: "--type must be slack", code: "invalid_input" }, json)
}

function parseEnabledFlag(args: { enabled?: boolean; disabled?: boolean }, json: boolean) {
  if (args.enabled === true && args.disabled === true) {
    return outputError(
      { message: "Use either --enabled or --disabled, not both", code: "invalid_input" },
      json,
    )
  }

  if (args.enabled === true) return true
  if (args.disabled === true) return false

  return undefined
}

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update an Outlit Slack channel automation destination.",
      "",
      "Provide --type slack plus one or more fields to patch.",
      "",
      "Examples:",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type slack --label '#customer-ops' --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type slack --default --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type slack --disabled --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Destination ID to update",
      required: true,
    },
    type: {
      type: "string",
      description: "Required destination type: slack",
    },
    label: { type: "string", description: "Slack channel label" },
    default: { type: "boolean", description: "Make this the default destination" },
    enabled: { type: "boolean", description: "Enable the destination after update" },
    disabled: { type: "boolean", description: "Disable the destination" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const type = parseDestinationType(requiredTrimmedString(args.type, "--type", json), json)
    const enabled = parseEnabledFlag(
      {
        enabled: args.enabled,
        disabled: args.disabled,
      },
      json,
    )
    if (args.default === true && args.disabled === true) {
      return outputError(
        { message: "Use either --default or --disabled, not both", code: "invalid_input" },
        json,
      )
    }
    const label = optionalTrimmedString(args.label)
    const input = {
      id: args.id,
      type,
      ...(label ? { label } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(args.default === true ? { isDefault: true } : {}),
    }

    if (!("label" in input) && !("enabled" in input) && !("isDefault" in input)) {
      return outputError(
        {
          message: "Provide at least one destination field to update",
          code: "missing_input",
        },
        json,
      )
    }

    return runTool(client, "outlit_destination_update", input, json, {
      spinnerMessage: "Updating destination...",
    })
  },
})
