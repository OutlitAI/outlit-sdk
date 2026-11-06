import { customerBillingStatuses, publicToolContracts } from "@outlit/tools"
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
import { formatArr, relativeDate, truncate } from "../../lib/format"
import { outputError } from "../../lib/output"
import { isIso8601DateTime } from "../../lib/platform-input"

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

/**
 * Reads the last value given for an undeclared `--flag value` or `--flag=value` option. Returns
 * undefined when the flag is absent and "" when it is present without a value (a following token
 * that starts with `--` is the next flag, not a value).
 */
function rawFlagValue(rawArgs: string[] | undefined, flag: string): string | undefined {
  let value: string | undefined
  for (const [index, arg] of (rawArgs ?? []).entries()) {
    if (arg === `--${flag}`) {
      const next = rawArgs?.[index + 1]
      value = next === undefined || next.startsWith("--") ? "" : next
    } else if (arg.startsWith(`--${flag}=`)) value = arg.slice(flag.length + 3)
  }
  return value
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
      "  outlit customers list --arr-above 1200000 --limit 50    # high-value at-risk",
      "  outlit customers list --activated-since 2026-07-01T00:00:00Z",
      "  outlit customers list --json | jq '.items[].domain'     # pipe-friendly",
      "",
      `Billing statuses: ${customerBillingStatuses.join(", ")}`,
      "Sort fields: last_activity_at, first_seen_at, name, arr_cents",
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
    "arr-above": {
      type: "string",
      description:
        "Filter by ARR above threshold per year, in the billing provider's minor units: cents for USD, EUR, GBP and CAD (e.g. 1200000 = $12,000/yr in USD)",
    },
    "arr-below": {
      type: "string",
      description: "Filter by ARR below threshold per year, in the same units as --arr-above",
    },
    "owner-id": {
      type: "string",
      description: "Filter by internal customer owner user ID",
    },
    "owner-email": {
      type: "string",
      description: "Filter by internal customer owner email",
    },
    "has-owner": {
      type: "boolean",
      description: "Filter to customers that have an internal owner",
    },
    "activated-since": {
      type: "string",
      description:
        "Filter by company activation at or after an ISO-8601 datetime (offsets allowed)",
    },
    search: {
      type: "string",
      description: "Search by customer name or domain",
    },
  },
  async run({ args, rawArgs }) {
    const json = !!args.json
    const activatedSince = args["activated-since"]
    if (activatedSince !== undefined && !isIso8601DateTime(activatedSince)) {
      return outputError(
        {
          message: "--activated-since must be a valid ISO 8601 datetime",
          code: "invalid_input",
        },
        json,
      )
    }
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args["billing-status"]) params.billingStatus = args["billing-status"]
    // --mrr-above and --mrr-below are previously published spellings: still accepted from the raw
    // arguments, but no longer declared, so help and completions advertise only --arr-*.
    const numericFlags = [
      ["arr-above", "arrAbove", args["arr-above"]],
      ["arr-below", "arrBelow", args["arr-below"]],
      ["mrr-above", "mrrAbove", rawFlagValue(rawArgs, "mrr-above")],
      ["mrr-below", "mrrBelow", rawFlagValue(rawArgs, "mrr-below")],
    ] as const
    for (const [flag, param, raw] of numericFlags) {
      if (raw === undefined) continue
      const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN
      if (!Number.isFinite(value)) {
        return outputError({ message: `--${flag} must be a number`, code: "invalid_input" }, json)
      }
      params[param] = value
    }
    if (args["owner-id"]) params.ownerId = args["owner-id"]
    if (args["owner-email"]) params.ownerEmail = args["owner-email"]
    if (typeof args["has-owner"] === "boolean") params.hasOwner = args["has-owner"]
    if (activatedSince) params.activatedSince = activatedSince
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

    return runTool(client, publicToolContracts.outlit_list_customers.toolName, params, json, {
      spinnerMessage: "Fetching customers...",
      transform: normalizeCustomerListResult,
      table: {
        columns: [
          { header: "Name", key: "name", format: (v) => truncate(v, 24) },
          { header: "Domain", key: "domain" },
          { header: "Billing", key: "billingStatus" },
          { header: "ARR", key: "arr", format: formatArr },
          { header: "Last Active", key: "lastActivityAt", format: relativeDate },
        ],
      },
    })
  },
})
