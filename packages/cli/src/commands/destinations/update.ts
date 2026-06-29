import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

function parseDestinationType(type: string, json: boolean): "WEBHOOK_ENDPOINT" | "SLACK_CHANNEL" {
  const normalized = type.trim().toLowerCase()
  if (normalized === "webhook" || normalized === "webhook_endpoint") {
    return "WEBHOOK_ENDPOINT"
  }

  if (normalized === "slack" || normalized === "slack_channel") {
    return "SLACK_CHANNEL"
  }

  return outputError({ message: "--type must be webhook or slack", code: "invalid_input" }, json)
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
      "Update an Outlit automation destination.",
      "",
      "Provide --type webhook or --type slack plus one or more fields to patch.",
      "",
      "Examples:",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type webhook --name 'Customer ops' --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type webhook --url https://hooks.example.com/outlit --json",
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
      description: "Required destination type: webhook or slack",
    },
    name: { type: "string", description: "Webhook destination name" },
    url: { type: "string", description: "Optional webhook URL" },
    label: { type: "string", description: "Slack channel label" },
    description: { type: "string", description: "Optional destination description" },
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
    const input =
      type === "SLACK_CHANNEL"
        ? {
            id: args.id,
            type,
            ...(optionalTrimmedString(args.label ?? args.name)
              ? { label: optionalTrimmedString(args.label ?? args.name) }
              : {}),
            ...(enabled !== undefined ? { enabled } : {}),
          }
        : {
            id: args.id,
            type: "WEBHOOK_ENDPOINT",
            ...(optionalTrimmedString(args.name) ? { name: optionalTrimmedString(args.name) } : {}),
            ...(args.description !== undefined
              ? { description: optionalTrimmedString(args.description) }
              : {}),
            ...(enabled !== undefined ? { enabled } : {}),
            ...(optionalTrimmedString(args.url) ? { url: optionalTrimmedString(args.url) } : {}),
          }

    if (
      !("name" in input) &&
      !("description" in input) &&
      !("url" in input) &&
      !("label" in input) &&
      !("enabled" in input)
    ) {
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
