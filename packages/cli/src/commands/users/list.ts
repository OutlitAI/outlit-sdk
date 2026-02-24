import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { activityFilterArgs, applyListFilters, orderArgs } from "../../args/filters"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { relativeDate, truncate } from "../../lib/format"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List and filter users across your customer base.",
      "",
      "Filter by journey stage, customer, activity, and search term.",
      "Output is JSON when piped or when --json is passed.",
      "",
      "Examples:",
      "  outlit users list                                          # all users",
      "  outlit users list --journey-stage CHAMPION                # champions only",
      "  outlit users list --customer-id <uuid>                    # users for a customer",
      "  outlit users list --no-activity-in 30d                    # inactive users",
      "  outlit users list --search alice --order-by last_activity_at",
      "  outlit users list --json | jq '.[].email'                 # pipe-friendly",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    "journey-stage": {
      type: "string",
      description: "Filter by journey stage (e.g. CHAMPION, AT_RISK, CHURNED)",
    },
    "customer-id": {
      type: "string",
      description: "Filter users belonging to a specific customer (UUID)",
    },
    ...activityFilterArgs,
    ...orderArgs,
    search: {
      type: "string",
      description: "Search by user name or email",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args["journey-stage"]) params.journeyStage = args["journey-stage"]
    if (args["customer-id"]) params.customerId = args["customer-id"]
    applyListFilters(params, args)
    applyPagination(params, args, json)

    return runTool(client, "outlit_list_users", params, json, {
      spinnerMessage: "Fetching users...",
      table: {
        columns: [
          { header: "Email", key: "email", format: (v) => truncate(v, 30) },
          { header: "Name", key: "name", format: (v) => truncate(v, 20) },
          { header: "Journey", key: "journeyStage" },
          { header: "Customer", key: "customerId", format: (v) => truncate(v, 12) },
          { header: "Last Active", key: "lastActivityAt", format: relativeDate },
        ],
      },
    })
  },
})
