import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { activityFilterArgs, applyListFilters, orderArgs } from "../../args/filters"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { formatCents, relativeDate, truncate } from "../../lib/format"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List and filter customers with risk signals.",
      "",
      "Filter by billing status, activity, and revenue metrics.",
      "Output is JSON when piped or when --json is passed.",
      "",
      "Examples:",
      "  outlit customers list                                    # all customers",
      "  outlit customers list --billing-status PAYING           # paying only",
      "  outlit customers list --no-activity-in 30d              # churning customers",
      "  outlit customers list --mrr-above 10000 --limit 50      # high-value at-risk",
      "  outlit customers list --json | jq '.items[].domain'     # pipe-friendly",
      "",
      "Billing statuses: NONE, TRIALING, PAYING, CHURNED",
      "Activity periods: 7d, 14d, 30d, 90d",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    ...activityFilterArgs,
    ...orderArgs,
    "billing-status": {
      type: "string",
      description: "Filter by billing status (NONE, TRIALING, PAYING, CHURNED)",
    },
    "mrr-above": {
      type: "string",
      description: "Filter by MRR above threshold in cents (e.g. 10000 = $100/mo)",
    },
    "mrr-below": {
      type: "string",
      description: "Filter by MRR below threshold in cents",
    },
    search: {
      type: "string",
      description: "Search by customer name or domain",
    },
    status: {
      type: "string",
      description: "Customer status filter (PROVISIONAL, ACTIVE, CHURNED, MERGED)",
    },
    type: {
      type: "string",
      description: "Customer type filter (COMPANY, INDIVIDUAL)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args["billing-status"]) params.billingStatus = args["billing-status"]
    if (args["mrr-above"]) params.mrrAbove = Number(args["mrr-above"])
    if (args["mrr-below"]) params.mrrBelow = Number(args["mrr-below"])
    applyListFilters(params, args)
    applyPagination(params, args)
    if (args.status) params.status = args.status
    if (args.type) params.type = args.type

    return runTool(client, "outlit_list_customers", params, json, {
      spinnerMessage: "Fetching customers...",
      table: {
        columns: [
          { header: "Name", key: "name", format: (v) => truncate(v, 24) },
          { header: "Domain", key: "domain" },
          { header: "Billing", key: "billingStatus" },
          { header: "MRR", key: "currentMrr", format: formatCents },
          { header: "Last Active", key: "lastActivityAt", format: relativeDate },
        ],
      },
    })
  },
})
