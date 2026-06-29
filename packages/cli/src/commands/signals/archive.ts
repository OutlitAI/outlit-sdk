import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "archive",
    description: [
      "Archive a configured Outlit automation signal by id.",
      "",
      "Examples:",
      "  outlit signals archive 10000000-0000-4000-8000-000000000002 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Signal ID to archive",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_signal_archive", { id: args.id }, json, {
      spinnerMessage: "Archiving signal...",
    })
  },
})
