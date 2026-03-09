import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { capitalize, relativeDate, truncate } from "../../lib/format"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List available integrations and their connection status.",
      "",
      "Shows all supported third-party integrations with whether they",
      "are connected, available, or in an error state.",
      "",
      "Examples:",
      "  outlit integrations list",
      "  outlit integrations list --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_list_integrations", {}, json, {
      spinnerMessage: "Fetching integrations...",
      table: {
        columns: [
          { header: "Name", key: "name", format: (v) => truncate(v, 24) },
          { header: "Category", key: "category", format: capitalize },
          { header: "Status", key: "status" },
          { header: "Last Synced", key: "lastDataReceivedAt", format: relativeDate },
        ],
      },
    })
  },
})
