import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create an Outlit workspace usage metric.",
      "",
      "Examples:",
      "  outlit metrics create --name 'Monthly Active Users' --description 'Count of active users in the month' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    name: { type: "string", description: "Usage metric name" },
    description: { type: "string", description: "Optional usage metric description" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const name = requiredTrimmedString(args.name, "--name", json)
    const description = optionalTrimmedString(args.description)
    const input = description ? { name, description } : { name }

    return runTool(client, "outlit_create_usage_metric", input, json, {
      spinnerMessage: "Creating usage metric...",
    })
  },
})
