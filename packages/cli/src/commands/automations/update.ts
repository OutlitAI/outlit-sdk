import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { readJsonBodyOrExit } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update an Outlit automation for an agent.",
      "",
      "Pass the automation body as JSON with --data or --file. The body must include agentId.",
      "",
      "Examples:",
      "  outlit automations update 10000000-0000-4000-8000-000000000001 --file ./automation.json --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Automation ID to update",
      required: true,
    },
    data: { type: "string", description: "Automation JSON body" },
    file: { type: "string", description: "Path to automation JSON body" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input = readJsonBodyOrExit({ data: args.data, file: args.file, json })

    return runTool(client, "outlit_automation_update", { ...input, id: args.id }, json, {
      spinnerMessage: "Updating automation...",
    })
  },
})
