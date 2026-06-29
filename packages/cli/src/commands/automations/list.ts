import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { relativeDate, truncate } from "../../lib/format"

function formatCount(value: unknown): string {
  return typeof value === "number" ? String(value) : "--"
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Outlit automations.",
      "",
      "Examples:",
      "  outlit automations list",
      "  outlit automations list --json",
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

    return runTool(client, "outlit_automation_list", {}, json, {
      spinnerMessage: "Fetching automations...",
      table: {
        itemsKey: "result.data.automations",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Name", key: "name", format: (v) => truncate(v, 28) },
          { header: "Enabled", key: "enabled", format: (v) => (v === true ? "yes" : "no") },
          { header: "Trigger", key: "triggerType", format: (v) => truncate(v, 20) },
          { header: "Agent", key: "agentId", format: (v) => truncate(v, 22) },
          { header: "Signals", key: "activeSignalCount", format: formatCount },
          { header: "Destinations", key: "activeDestinationCount", format: formatCount },
          { header: "Updated", key: "updatedAt", format: relativeDate },
        ],
      },
    })
  },
})
