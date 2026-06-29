import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { relativeDate, truncate } from "../../lib/format"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Outlit automation signals.",
      "",
      "Examples:",
      "  outlit signals list",
      "  outlit signals list --json",
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

    return runTool(client, "outlit_signal_list", {}, json, {
      spinnerMessage: "Fetching signals...",
      table: {
        itemsKey: "result.data.signals",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Name", key: "name", format: (v) => truncate(v, 32) },
          { header: "Kind", key: "kind", format: (v) => truncate(v, 20) },
          { header: "Managed", key: "managedBy" },
          { header: "Updated", key: "updatedAt", format: relativeDate },
        ],
      },
    })
  },
})
