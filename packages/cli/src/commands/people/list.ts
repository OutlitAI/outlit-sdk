import { getPublicToolContract, personOrderFields } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import {
  activityFilterArgs,
  orderArgs,
  parseTraitFilters,
  rawFlagValue,
  readActivityFilterArgs,
  traitFilterArgs,
} from "../../args/filters"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
import { relativeDate, truncate } from "../../lib/format"
import { outputError } from "../../lib/output"

const filterProperties =
  getPublicToolContract("outlit_list_people").inputSchema.properties.filters.properties
const journeyStages = filterProperties.journeyStage.items.enum
const personRoles = filterProperties.role.items.enum

/** Previously published sort name, accepted and mapped to the current one. */
const legacyOrderFields: Record<string, (typeof personOrderFields)[number]> = {
  first_seen_at: "first_synced_at",
}

// A whole number of minutes, hours or days. The CLI owns this check instead of reading the contract's
// pattern: that pattern comes from the built @outlit/tools, which can be older than this source and
// would then reject a unit the help text names. Core enforces the upper bound (3650 days).
const activityWindow = /^[1-9]\d{0,4}[dhm]$/

/** The names of a CSV flag that the contract's enum accepts, case-insensitively. */
function parseEnumList(
  value: string,
  allowed: readonly string[],
  flag: string,
  json: boolean,
): string[] {
  const values = splitCsv(value).map((entry) => entry.toLowerCase())
  const unknown = values.filter((entry) => !allowed.includes(entry))
  if (unknown.length > 0) {
    return outputError(
      {
        message: `${flag} does not accept ${unknown.join(", ")}. Allowed: ${allowed.join(", ")}`,
        code: "invalid_input",
      },
      json,
    )
  }
  return values
}

function formatCustomer(value: unknown): string {
  if (typeof value !== "object" || value === null) return "--"
  const { name, domain } = value as { name?: unknown; domain?: unknown }
  return truncate(name ?? domain, 20)
}

function formatLastCommunication(value: unknown): string {
  if (typeof value !== "object" || value === null) return "--"
  return relativeDate((value as { occurredAt?: unknown }).occurredAt)
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List the people at your customers: who the champion is, who went quiet, who last spoke to us.",
      "",
      "With --customer it also lists people at other customers who are CRM contacts of that",
      "customer's companies. Each person carries when they last took part in a conversation.",
      "Output is JSON when piped or when --json is passed.",
      "",
      "Examples:",
      "  outlit people list                                          # everyone",
      "  outlit people list --customer acme.com                      # the people at one customer",
      "  outlit people list --journey-stage engaged                  # engaged people only",
      "  outlit people list --role champion --no-activity-in 30d     # quiet champions",
      "  outlit people list --search alice --order-by last_activity_at",
      "  outlit people list --json | jq '.items[].email'             # pipe-friendly",
      "",
      `Journey stages: ${journeyStages.join(", ")}`,
      `Roles: ${personRoles.join(", ")}`,
      `Sort fields: ${personOrderFields.join(", ")}`,
      "Activity periods: whole minutes, hours or days, such as 90m, 12h or 30d (at most 3650d)",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    ...traitFilterArgs,
    ...activityFilterArgs,
    ...orderArgs,
    customer: {
      type: "string",
      description: "Only the people at this customer (ID, domain or name)",
    },
    "journey-stage": {
      type: "string",
      description: `Filter by journey stage (${journeyStages.join(", ")}); comma-separate several`,
    },
    role: {
      type: "string",
      description: `Filter by role (${personRoles.join(", ")}); comma-separate several`,
    },
    cursor: {
      type: "string",
      description:
        "Cursor from a previous response (page.nextCursor).\nUse this to fetch the next page of results.",
    },
    search: {
      type: "string",
      description: "Search by person name or email",
    },
  },
  async run({ args, rawArgs }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    const filters: Record<string, unknown> = {}

    // --customer-id is the previously published spelling: still accepted, no longer declared.
    const customer = args.customer ?? rawFlagValue(rawArgs, "customer-id")
    if (customer) params.customer = customer

    if (args["journey-stage"]) {
      filters.journeyStage = parseEnumList(
        args["journey-stage"],
        journeyStages,
        "--journey-stage",
        json,
      )
    }
    if (args.role) filters.role = parseEnumList(args.role, personRoles, "--role", json)

    const { noActivityIn, hasActivityIn } = readActivityFilterArgs(args, rawArgs)
    const activity: Record<string, unknown> = {}
    for (const [flag, key, value] of [
      ["--has-activity-in", "within", hasActivityIn],
      ["--no-activity-in", "notWithin", noActivityIn],
    ] as const) {
      if (!value) continue
      if (!activityWindow.test(value)) {
        return outputError(
          {
            message: `${flag} must be a whole number of days, hours or minutes such as 30d, 12h or 90m (got: ${value})`,
            code: "invalid_input",
          },
          json,
        )
      }
      activity[key] = value
    }
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

    return runTool(client, "outlit_list_people", params, json, {
      spinnerMessage: "Fetching people...",
      table: {
        paginationKey: "page",
        columns: [
          { header: "Email", key: "email", format: (v) => truncate(v, 30) },
          { header: "Name", key: "name", format: (v) => truncate(v, 20) },
          { header: "Title", key: "title", format: (v) => truncate(v, 20) },
          { header: "Journey", key: "journeyStage" },
          { header: "Customer", key: "customer", format: formatCustomer },
          { header: "Last Contact", key: "lastCommunication", format: formatLastCommunication },
          { header: "Last Active", key: "lastActivityAt", format: relativeDate },
        ],
      },
    })
  },
})
