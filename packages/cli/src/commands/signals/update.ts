import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { readJsonBodyOrExit } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update an Outlit automation signal.",
      "",
      "Pass the signal body as JSON with --data or --file.",
      "",
      "Examples:",
      "  outlit signals update 10000000-0000-4000-8000-000000000002 --file ./signal.json --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Signal ID to update",
      required: true,
    },
    data: { type: "string", description: "Signal JSON body" },
    file: { type: "string", description: "Path to signal JSON body" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input = readJsonBodyOrExit({ data: args.data, file: args.file, json })

    return runTool(client, "outlit_signal_update", { ...input, id: args.id }, json, {
      spinnerMessage: "Updating signal...",
    })
  },
})
