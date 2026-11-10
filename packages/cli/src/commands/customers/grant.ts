import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { newRequestId } from "../../lib/request-id"
import { readAccessConfirmation } from "./access-confirmation"
import {
  customerAccessRoleArg,
  customerCollaborationArgs,
  parseCustomerAccessRole,
  parseCustomerCollaboration,
} from "./collaboration-input"

export default defineCommand({
  meta: {
    name: "grant",
    description: [
      "Grant or change Viewer or Editor customer access for an active workspace member.",
      "Re-run this command with a different role to update an existing collaborator.",
      "The customer is an ID, domain, or exact name; the member is a user ID or email.",
      "Take members from `outlit ws-users list`.",
      "",
      "A change you could not undo, such as reducing your own access, is shown first.",
      "In a terminal you are asked to confirm; otherwise pass --yes, or nothing changes and",
      "the command exits 1.",
      "",
      "Example:",
      "  outlit customers grant acme.com --member user_123 --role viewer --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...yesArg,
    ...customerCollaborationArgs,
    ...customerAccessRoleArg,
  },
  async run({ args }) {
    const json = !!args.json
    const target = parseCustomerCollaboration(args, json)
    const role = parseCustomerAccessRole(args.role, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runConfirmedWrite(client, "outlit_set_customer_access", {
      input: { ...target, role, requestId: newRequestId() },
      json,
      yes: args.yes === true,
      spinnerMessage: "Granting customer access...",
      pending: readAccessConfirmation,
      confirmed: (previewToken) => ({
        ...target,
        role,
        mode: "execute",
        previewToken,
        requestId: newRequestId(),
      }),
      question: "Change this access?",
      unchanged: "Access was not changed",
    })
  },
})
