import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { customerCollaborationIdArgs, parseCustomerCollaborationIds } from "./collaboration-input"

export default defineCommand({
  meta: {
    name: "assign-owner",
    description: [
      "Assign an active workspace member as a customer's primary owner.",
      "The former owner keeps Editor access.",
      "Both IDs must be exact; discover them with customer and workspace-user list commands.",
      "",
      "Example:",
      "  outlit customers assign-owner 10000000-0000-4000-8000-000000000000 --target-user-id user_123 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...customerCollaborationIdArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const input = parseCustomerCollaborationIds(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, publicToolContracts.outlit_assign_customer_owner.toolName, input, json, {
      spinnerMessage: "Assigning customer owner...",
    })
  },
})
