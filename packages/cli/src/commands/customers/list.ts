import { customerBillingStatuses, customerToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import {
  activityFilterArgs,
  applyListFilters,
  orderArgs,
  parseTraitFilters,
  traitFilterArgs,
} from "../../args/filters"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { formatCents, relativeDate, truncate } from "../../lib/format"
import { outputError } from "../../lib/output"

function normalizeCustomerListResult(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data
  }

  const record = data as Record<string, unknown>
  if (!Array.isArray(record.items)) {
    return data
  }

  return {
    ...record,
    items: record.items.map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return item
      }

      const customer = item as Record<string, unknown>
      const daysSinceActivity = customer.daysSinceActivity
      if (typeof daysSinceActivity !== "number" || daysSinceActivity >= 0) {
        return item
      }

      return {
        ...customer,
        lastActivityAt: null,
        daysSinceActivity: null,
      }
    }),
  }
}

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
      `Billing statuses: ${customerBillingStatuses.join(", ")}`,
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
    ...traitFilterArgs,
    ...orderArgs,
    "billing-status": {
      type: "string",
      description: `Filter by billing status (${customerBillingStatuses.join(", ")})`,
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
  },
  async run({ args, rawArgs }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args["billing-status"]) params.billingStatus = args["billing-status"]
    if (args["mrr-above"]) {
      const value = Number(args["mrr-above"])
      if (!Number.isFinite(value)) {
        return outputError({ message: "--mrr-above must be a number", code: "invalid_input" }, json)
      }
      params.mrrAbove = value
    }
    if (args["mrr-below"]) {
      const value = Number(args["mrr-below"])
      if (!Number.isFinite(value)) {
        return outputError({ message: "--mrr-below must be a number", code: "invalid_input" }, json)
      }
      params.mrrBelow = value
    }
    if (args.trait) {
      try {
        const traitFilters = parseTraitFilters(args.trait)
        if (traitFilters) {
          params.traitFilters = traitFilters
        }
      } catch (error) {
        return outputError(
          {
            message: error instanceof Error ? error.message : "Invalid --trait filter",
            code: "invalid_input",
          },
          json,
        )
      }
    }
    applyListFilters(params, args, rawArgs)
    applyPagination(params, args, json)

    return runTool(client, customerToolContracts.outlit_list_customers.toolName, params, json, {
      spinnerMessage: "Fetching customers...",
      transform: normalizeCustomerListResult,
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
