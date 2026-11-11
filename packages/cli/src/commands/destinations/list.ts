import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { relativeDate, truncate } from "../../lib/format"
import { parseCsvList } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Outlit automation destinations with masked configuration only.",
      "",
      "Examples:",
      "  outlit destinations list",
      "  outlit destinations list --json",
      "  outlit destinations list --ids 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    ids: { type: "string", description: "Comma-separated destination IDs to read" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    applyPagination(params, args, json)
    const ids = parseCsvList(args.ids)
    if (ids.length > 0) params.ids = ids

    return runTool(client, "outlit_list_destinations", params, json, {
      spinnerMessage: "Fetching destinations...",
      table: {
        paginationKey: "page",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Name", key: "name", format: (v) => truncate(v, 32) },
          { header: "Provider", key: "provider" },
          { header: "Kind", key: "kind", format: (v) => truncate(v, 22) },
          { header: "Enabled", key: "enabled", format: (v) => (v === true ? "yes" : "no") },
          { header: "Sync", key: "delivery.status", format: (v) => truncate(v, 22) },
          { header: "Updated", key: "updatedAt", format: relativeDate },
        ],
      },
    })
  },
})
