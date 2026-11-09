import {
  customerBillingStatuses,
  customerListOrderFields,
  publicToolContracts,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import {
  activityFilterArgs,
  orderArgs,
  parseTraitFilters,
  readActivityFilterArgs,
  traitFilterArgs,
} from "../../args/filters"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
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

/** Previously published sort names, accepted and mapped to the current ones. */
const legacyOrderFields: Record<string, (typeof customerListOrderFields)[number]> = {
  arr_cents: "arr",
  mrr_cents: "arr",
  first_seen_at: "first_synced_at",
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
      "  outlit customers list --billing-status paying           # paying only",
      "  outlit customers list --no-activity-in 30d              # churning customers",
      "  outlit customers list --arr-above 1200000 --limit 50    # high-value at-risk",
      "  outlit customers list --activated-since 2026-07-01T00:00:00Z",
      "  outlit customers list --json | jq '.items[].domain'     # pipe-friendly",
      "",
      `Billing statuses: ${customerBillingStatuses.join(", ")}`,
      `Sort fields: ${customerListOrderFields.join(", ")}`,
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
    cursor: {
      type: "string",
      description:
        "Cursor from a previous response (page.nextCursor).\nUse this to fetch the next page of results.",
    },
    "billing-status": {
      type: "string",
      description: `Filter by billing status (${customerBillingStatuses.join(", ")}); comma-separate several`,
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
    currency: {
      type: "string",
      description:
        "Only customers whose ARR is in this ISO 4217 currency (e.g. USD). ARR is never converted, so use it to rank or bound ARR within one currency",
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
    const filters: Record<string, unknown> = {}
    const billingStatuses = args["billing-status"]
      ? splitCsv(args["billing-status"]).map((status) => status.toLowerCase())
      : []
    if (billingStatuses.length > 0) filters.billingStatus = billingStatuses

    // --mrr-above and --mrr-below are previously published spellings: still accepted from the raw
    // arguments, but no longer declared, so help and completions advertise only --arr-*. A monthly
    // amount filters as twelve months of it.
    const numericFlags = [
      ["arr-above", "above", 1, args["arr-above"]],
      ["arr-below", "below", 1, args["arr-below"]],
      ["mrr-above", "above", 12, rawFlagValue(rawArgs, "mrr-above")],
      ["mrr-below", "below", 12, rawFlagValue(rawArgs, "mrr-below")],
    ] as const
    const arr: Record<string, unknown> = {}
    for (const [flag, bound, factor, raw] of numericFlags) {
      if (raw === undefined) continue
      const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN
      if (!Number.isFinite(value)) {
        return outputError({ message: `--${flag} must be a number`, code: "invalid_input" }, json)
      }
      arr[bound] = Math.round(value * factor)
    }
    if (args.currency) {
      if (!/^[A-Za-z]{3}$/.test(args.currency)) {
        return outputError(
          { message: "--currency must be a three-letter ISO 4217 code", code: "invalid_input" },
          json,
        )
      }
      arr.currency = args.currency
    }
    if (Object.keys(arr).length > 0) filters.arr = arr

    const owner: Record<string, unknown> = {}
    if (args["owner-id"]) owner.id = args["owner-id"]
    if (args["owner-email"]) owner.email = args["owner-email"]
    if (typeof args["has-owner"] === "boolean") owner.has = args["has-owner"]
    if (Object.keys(owner).length > 0) filters.owner = owner

    const { noActivityIn, hasActivityIn } = readActivityFilterArgs(args, rawArgs)
    const activity: Record<string, unknown> = {}
    if (hasActivityIn) activity.within = hasActivityIn
    if (noActivityIn) activity.notWithin = noActivityIn
    if (activatedSince) activity.activatedSince = activatedSince
    if (Object.keys(activity).length > 0) filters.activity = activity

    if (args.trait) {
      try {
        const traitFilters = parseTraitFilters(args.trait)
        if (traitFilters) {
          filters.fields = Object.entries(traitFilters).map(([key, value]) => ({
            field: { source: "traits", key },
            op: "eq",
            value,
          }))
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
    if (args.search) filters.search = args.search
    if (Object.keys(filters).length > 0) params.filters = filters

    if (args["order-by"]) params.orderBy = legacyOrderFields[args["order-by"]] ?? args["order-by"]
    if (args["order-direction"]) params.orderDirection = args["order-direction"]
    applyPagination(params, args, json)

    return runTool(client, publicToolContracts.outlit_list_customers.toolName, params, json, {
      spinnerMessage: "Fetching customers...",
      transform: normalizeCustomerListResult,
      table: {
        paginationKey: "page",
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
