import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import {
  customerAccessRoleArg,
  customerCollaborationIdArgs,
  parseCustomerAccessRole,
  parseCustomerCollaborationIds,
} from "./collaboration-input"

export default defineCommand({
  meta: {
    name: "update-access",
    description: [
      "Change an existing customer collaborator between Viewer and Editor.",
      "Both IDs must be exact; discover them with customer and workspace-user list commands.",
      "",
      "Example:",
      "  outlit customers update-access 10000000-0000-4000-8000-000000000000 --target-user-id user_123 --role EDITOR --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...customerCollaborationIdArgs,
    ...customerAccessRoleArg,
  },
  async run({ args }) {
    const json = !!args.json
    const ids = parseCustomerCollaborationIds(args, json)
    const role = parseCustomerAccessRole(args.role, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_update_customer_access.toolName,
      { ...ids, role },
      json,
      { spinnerMessage: "Updating customer access..." },
    )
  },
})
