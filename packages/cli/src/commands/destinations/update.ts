import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, parseBooleanFlag } from "../../lib/platform-input"

/** --type is optional now (Core knows the destination's type); a value, when given, must still be slack. */
function checkDestinationType(type: string | undefined, json: boolean): void {
  const normalized = optionalTrimmedString(type)?.toLowerCase()
  if (!normalized) return
  if (normalized === "slack" || normalized === "slack_channel") return

  outputError({ message: "--type must be slack", code: "invalid_input" }, json)
}

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update an Outlit Slack channel automation destination.",
      "",
      "Provide one or more fields to patch.",
      "",
      "Examples:",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --label '#customer-ops' --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --is-default --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --enabled false --json",
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
      description: "Optional; destinations are Slack channels, so only slack is accepted",
    },
    label: { type: "string", description: "Slack channel label" },
    "is-default": { type: "boolean", description: "Make this the default destination" },
    enabled: { type: "string", description: "true or false: enable or disable the destination" },
    revision: {
      type: "string",
      description: "Destination revision from a read; refuses the change if it changed since",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    checkDestinationType(args.type, json)
    const enabled = parseBooleanFlag(args.enabled, "--enabled", json)
    if (args["is-default"] === true && enabled === false) {
      return outputError(
        { message: "A default destination cannot be disabled", code: "invalid_input" },
        json,
      )
    }
    const revision = optionalTrimmedString(args.revision)
    const label = optionalTrimmedString(args.label)
    const input = {
      id: args.id,
      ...(label ? { label } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(args["is-default"] === true ? { isDefault: true } : {}),
      ...(revision ? { revision } : {}),
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

    return runTool(client, "outlit_update_destination", input, json, {
      spinnerMessage: "Updating destination...",
    })
  },
})
