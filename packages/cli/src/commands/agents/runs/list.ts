import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { applyPagination, paginationArgs } from "../../../args/pagination"
import { getClientOrExit, runTool } from "../../../lib/api"
import { relativeDate, truncate } from "../../../lib/format"

function formatCount(value: unknown): string {
  return typeof value === "number" ? String(value) : "--"
}

function countField(field: "candidates" | "outputs" | "tools") {
  return (value: unknown): string => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return "--"
    return formatCount((value as Record<string, unknown>)[field])
  }
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List runs for one configured Outlit agent.",
      "",
      "Examples:",
      "  outlit agents runs list 10000000-0000-4000-8000-000000000004",
      "  outlit agents runs list 10000000-0000-4000-8000-000000000004 --limit 10 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    agentId: {
      type: "positional",
      description: "Agent ID",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = { agentId: args.agentId }
    applyPagination(params, { limit: args.limit, cursor: args.cursor }, json)

    return runTool(client, "outlit_agent_run_list", params, json, {
      spinnerMessage: "Fetching agent runs...",
      table: {
        itemsKey: "result.data.runs",
        paginationKey: "result.data.pagination",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Run ID", key: "runId", format: (v) => truncate(v, 22) },
          { header: "Status", key: "status" },
          { header: "Trigger", key: "trigger" },
          { header: "Candidates", key: "counts", format: countField("candidates") },
          { header: "Outputs", key: "counts", format: countField("outputs") },
          { header: "Tools", key: "counts", format: countField("tools") },
          { header: "Started", key: "startedAt", format: relativeDate },
        ],
      },
    })
  },
})
