import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { applyPagination, paginationArgs } from "../../../args/pagination"
import { getClientOrExit, runTool } from "../../../lib/api"
import { relativeDate, truncate } from "../../../lib/format"

function formatCount(value: unknown): string {
  return typeof value === "number" ? String(value) : "--"
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List runs for one configured Outlit automation.",
      "",
      "Examples:",
      "  outlit automations runs list 10000000-0000-4000-8000-000000000001",
      "  outlit automations runs list 10000000-0000-4000-8000-000000000001 --limit 10 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    automationId: {
      type: "positional",
      description: "Automation ID",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = { automationId: args.automationId }
    applyPagination(params, { limit: args.limit, cursor: args.cursor }, json)

    return runTool(client, "outlit_automation_run_list", params, json, {
      spinnerMessage: "Fetching automation runs...",
      table: {
        itemsKey: "result.data.runs",
        paginationKey: "result.data.pagination",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Status", key: "status" },
          { header: "Trigger", key: "triggerType" },
          { header: "Event", key: "eventName", format: (v) => truncate(v, 28) },
          { header: "Destinations", key: "destinationCount", format: formatCount },
          { header: "Matched", key: "matchedAt", format: relativeDate },
        ],
      },
    })
  },
})
