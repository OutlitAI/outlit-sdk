import { customerToolContracts, workspaceUserListOrderFields } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { truncate } from "../../lib/format"

const workspaceUserOrderArgs = {
  "order-by": {
    type: "string",
    description: `Sort field (${workspaceUserListOrderFields.join(", ")})`,
    default: "owned_customer_count",
  },
  "order-direction": {
    type: "string",
    description: "Sort direction (asc, desc)",
    default: "desc",
  },
} as const

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List and filter internal workspace users.",
      "",
      "Use this to discover CSMs, managers, and account owners before composing dynamic customer reports.",
      "Output is JSON when piped or when --json is passed.",
      "",
      "Examples:",
      "  outlit workspace-users list",
      "  outlit workspace-users list --role CSM --has-owned-customers",
      "  outlit workspace-users list --manager-email sandy@nooks.ai --json",
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
      description: "Return only workspace users who own at least one customer",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args.search) params.search = args.search
    if (args.role) params.role = args.role
    if (args["manager-email"]) params.managerEmail = args["manager-email"]
    if (args["has-owned-customers"]) params.hasOwnedCustomers = true
    if (args["order-by"]) params.orderBy = args["order-by"]
    if (args["order-direction"]) params.orderDirection = args["order-direction"]
    applyPagination(params, args, json)

    return runTool(
      client,
      customerToolContracts.outlit_list_workspace_users.toolName,
      params,
      json,
      {
        spinnerMessage: "Fetching workspace users...",
        table: {
          columns: [
            { header: "Email", key: "email", format: (v) => truncate(v, 30) },
            { header: "Name", key: "name", format: (v) => truncate(v, 24) },
            { header: "Role", key: "role" },
            { header: "Title", key: "title", format: (v) => truncate(v, 24) },
            { header: "Manager", key: "managerEmail", format: (v) => truncate(v, 24) },
            { header: "Owned", key: "ownedCustomerCount" },
          ],
        },
      },
    )
  },
})
