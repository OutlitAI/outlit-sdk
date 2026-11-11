import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { truncate } from "../../lib/format"
import { outputError } from "../../lib/output"

const orderDirections = ["asc", "desc"] as const
const memberOrderFields =
  publicToolContracts.outlit_list_members.inputSchema.properties.orderBy.enum

/** `owned_customer_count` is how this flag has always spelled the order the tool calls `owned_customers`. */
const previousOrderSpellings = { owned_customer_count: "owned_customers" } as const

const workspaceUserOrderArgs = {
  "order-by": {
    type: "string",
    description: `Sort field (${memberOrderFields.join(", ")}). Default: owned_customers`,
  },
  "order-direction": {
    type: "string",
    description: "Sort direction (asc, desc). Default: desc for owned_customers, asc for name",
  },
} as const

function readOrderField(value: unknown): (typeof memberOrderFields)[number] | null {
  if (typeof value !== "string") return null
  const spelled =
    value in previousOrderSpellings
      ? previousOrderSpellings[value as keyof typeof previousOrderSpellings]
      : value
  return memberOrderFields.find((field) => field === spelled) ?? null
}

function isOrderDirection(value: unknown): value is (typeof orderDirections)[number] {
  return typeof value === "string" && orderDirections.some((direction) => direction === value)
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List all active workspace members with local Outlit user records.",
      "",
      "By default, customer ownership does not limit results; --has-owned-customers is the only customer-related filter.",
      "Use JSON output to copy exact user IDs for customer ownership and access commands.",
      "Output is JSON when piped or when --json is passed.",
      "",
      "Examples:",
      "  outlit members list",
      "  outlit members list --role CSM --has-owned-customers",
      "  outlit members list --manager-email sandy@nooks.ai --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    ...workspaceUserOrderArgs,
    search: {
      type: "string",
      description: "Search by name, email, title, role, or territory",
    },
    role: {
      type: "string",
      description: "Filter by workspace-user role metadata",
    },
    "manager-email": {
      type: "string",
      description: "Filter by manager email metadata",
    },
    "has-owned-customers": {
      type: "boolean",
      description: "Return only members who own customers; omit for all eligible members",
    },
  },
  async run({ args }) {
    const json = !!args.json

    const orderField = args["order-by"] ? readOrderField(args["order-by"]) : null
    if (args["order-by"] && !orderField) {
      return outputError(
        {
          message: `--order-by must be one of: ${memberOrderFields.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }
    if (args["order-direction"] && !isOrderDirection(args["order-direction"])) {
      return outputError(
        { message: "--order-direction must be one of: asc, desc", code: "invalid_input" },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    const filters: Record<string, unknown> = {}
    if (args.search) filters.search = args.search
    if (args.role) filters.role = args.role
    if (args["manager-email"]) filters.managerEmail = args["manager-email"]
    if (typeof args["has-owned-customers"] === "boolean") {
      filters.hasOwnedCustomers = args["has-owned-customers"]
    }
    if (Object.keys(filters).length > 0) params.filters = filters
    if (orderField) params.orderBy = orderField
    if (args["order-direction"]) params.orderDirection = args["order-direction"]
    applyPagination(params, args, json)

    return runTool(client, publicToolContracts.outlit_list_members.toolName, params, json, {
      spinnerMessage: "Fetching workspace users...",
      table: {
        paginationKey: "page",
        columns: [
          { header: "Email", key: "email", format: (v) => truncate(v, 30) },
          { header: "Name", key: "name", format: (v) => truncate(v, 24) },
          { header: "Role", key: "role" },
          { header: "Title", key: "title", format: (v) => truncate(v, 24) },
          { header: "Manager", key: "managerEmail", format: (v) => truncate(v, 24) },
          { header: "Owned", key: "ownedCustomers" },
        ],
      },
    })
  },
})
