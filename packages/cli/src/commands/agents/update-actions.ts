import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { parseCsvList } from "../../lib/platform-input"

function parseActionKeys(args: { "action-keys"?: string; clear?: boolean }, json: boolean) {
  if (args.clear === true && args["action-keys"] !== undefined) {
    return outputError(
      { message: "Use either --action-keys or --clear, not both", code: "invalid_input" },
      json,
    )
  }

  if (args.clear === true) {
    return []
  }

  const actionKeys = parseCsvList(args["action-keys"])
  if (actionKeys.length === 0) {
    return outputError(
      {
        message: "Provide --action-keys or --clear for agent action updates",
        code: "missing_input",
      },
      json,
    )
  }

  return actionKeys
}

export default defineCommand({
  meta: {
    name: "update-actions",
    description: [
      "Update a custom hosted Outlit agent's action keys.",
      "",
      "Provide --action-keys to set keys, or --clear to remove all keys.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Agent ID", required: true },
    "action-keys": { type: "string", description: "Comma-separated action keys" },
    clear: { type: "boolean", description: "Clear all action keys" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_agent_update_actions",
      { id: args.id, actionKeys: parseActionKeys(args, json) },
      json,
      { spinnerMessage: "Updating agent actions..." },
    )
  },
})
