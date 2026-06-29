import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, parseCsvList } from "../../lib/platform-input"

function parseActionKeys(args: { "action-keys"?: string; "clear-action-keys"?: boolean }) {
  if (args["clear-action-keys"] === true && args["action-keys"] !== undefined) {
    return {
      ok: false as const,
      message: "Use either --action-keys or --clear-action-keys, not both",
    }
  }

  if (args["clear-action-keys"] === true) {
    return { ok: true as const, value: [] as string[] }
  }

  if (args["action-keys"] === undefined) {
    return { ok: true as const, value: undefined }
  }

  const actionKeys = parseCsvList(args["action-keys"])
  if (actionKeys.length === 0) {
    return {
      ok: false as const,
      message: "Provide at least one action key, or use --clear-action-keys",
    }
  }

  return { ok: true as const, value: actionKeys }
}

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update an Outlit agent.",
      "",
      "Examples:",
      "  outlit agents update 10000000-0000-4000-8000-000000000004 --display-name 'Renewal risk' --json",
      "  outlit agents update 10000000-0000-4000-8000-000000000004 --instructions 'Prioritize recent escalations' --json",
      "  outlit agents update 10000000-0000-4000-8000-000000000004 --action-keys send_slack_notification --json",
      "  outlit agents update 10000000-0000-4000-8000-000000000004 --clear-action-keys --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Agent ID", required: true },
    "display-name": { type: "string", description: "Agent display name" },
    instructions: { type: "string", description: "Agent instructions" },
    "action-keys": { type: "string", description: "Comma-separated action keys" },
    "clear-action-keys": { type: "boolean", description: "Clear all action keys" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const actionKeys = parseActionKeys(args)

    if (!actionKeys.ok) {
      return outputError({ message: actionKeys.message, code: "invalid_input" }, json)
    }

    const input = {
      id: args.id,
      ...(optionalTrimmedString(args["display-name"])
        ? { displayName: optionalTrimmedString(args["display-name"]) }
        : {}),
      ...(optionalTrimmedString(args.instructions)
        ? { instructions: optionalTrimmedString(args.instructions) }
        : {}),
      ...(actionKeys.value !== undefined ? { actionKeys: actionKeys.value } : {}),
    }

    if (!("displayName" in input) && !("instructions" in input) && !("actionKeys" in input)) {
      return outputError(
        {
          message: "Provide --display-name, --instructions, --action-keys, or --clear-action-keys",
          code: "missing_input",
        },
        json,
      )
    }

    return runTool(client, "outlit_agent_update", input, json, {
      spinnerMessage: "Updating agent...",
    })
  },
})
