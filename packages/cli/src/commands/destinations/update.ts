import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

function parseDestinationType(type: string, json: boolean): "WEBHOOK_ENDPOINT" | "SLACK_CHANNEL" {
  if (type === "WEBHOOK_ENDPOINT" || type === "SLACK_CHANNEL") {
    return type
  }

  return outputError(
    { message: "--type must be WEBHOOK_ENDPOINT or SLACK_CHANNEL", code: "invalid_input" },
    json,
  )
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

  return outputError(
    { message: "Provide --enabled or --disabled for destination update", code: "missing_input" },
    json,
  )
}

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update an Outlit automation destination.",
      "",
      "Destination updates require an explicit lifecycle state with --enabled or --disabled.",
      "",
      "Examples:",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type WEBHOOK_ENDPOINT --name 'Customer ops' --url https://hooks.example.com/outlit --enabled --json",
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
      description: "Destination type: WEBHOOK_ENDPOINT or SLACK_CHANNEL",
      default: "WEBHOOK_ENDPOINT",
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
            label: requiredTrimmedString(args.label ?? args.name, "--label", json),
            enabled,
          }
        : {
            id: args.id,
            type: "WEBHOOK_ENDPOINT",
            name: requiredTrimmedString(args.name, "--name", json),
            description: optionalTrimmedString(args.description),
            enabled,
            ...(optionalTrimmedString(args.url) ? { url: optionalTrimmedString(args.url) } : {}),
          }

    return runTool(client, "outlit_destination_update", input, json, {
      spinnerMessage: "Updating destination...",
    })
  },
})
