import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { relativeDate, truncate } from "../../lib/format"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Outlit automation destinations with masked configuration only.",
      "",
      "Examples:",
      "  outlit destinations list",
      "  outlit destinations list --json",
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

    return runTool(client, "outlit_destination_list", {}, json, {
      spinnerMessage: "Fetching destinations...",
      table: {
        itemsKey: "result.data.destinations",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Name", key: "name", format: (v) => truncate(v, 32) },
          { header: "Provider", key: "provider" },
          { header: "Kind", key: "kind", format: (v) => truncate(v, 22) },
          { header: "Enabled", key: "enabled", format: (v) => (v === true ? "yes" : "no") },
          { header: "Sync", key: "syncStatus", format: (v) => truncate(v, 22) },
          { header: "Updated", key: "updatedAt", format: relativeDate },
        ],
      },
    })
  },
})
