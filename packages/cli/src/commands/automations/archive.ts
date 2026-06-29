import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "archive",
    description: [
      "Archive a configured Outlit automation by id.",
      "",
      "Examples:",
      "  outlit automations archive 10000000-0000-4000-8000-000000000001 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Automation ID to archive",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_automation_archive", { id: args.id }, json, {
      spinnerMessage: "Archiving automation...",
    })
  },
})
