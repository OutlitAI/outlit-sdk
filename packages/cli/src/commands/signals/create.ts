import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { readJsonBodyOrExit } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create an Outlit automation signal.",
      "",
      "Pass the signal body as JSON with --data or --file.",
      "",
      "Examples:",
      '  outlit signals create --data \'{"kind":"EVENT_MATCH","name":"Workspace inactive","description":null,"definition":{"grain":"customer","subjectResolver":"event_customer","eventNames":["workspace_inactive"],"propertyConditions":[],"conditionMode":"ALL"}}\' --json',
      "  outlit signals create --file ./signal.json --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    data: { type: "string", description: "Signal JSON body" },
    file: { type: "string", description: "Path to signal JSON body" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input = readJsonBodyOrExit({ data: args.data, file: args.file, json })

    return runTool(client, "outlit_signal_create", input, json, {
      spinnerMessage: "Creating signal...",
    })
  },
})
