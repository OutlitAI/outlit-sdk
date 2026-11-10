import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { newRequestId } from "../../lib/request-id"
import { readAccessConfirmation } from "./access-confirmation"
import { customerCollaborationArgs, parseCustomerCollaboration } from "./collaboration-input"

export default defineCommand({
  meta: {
    name: "revoke",
    description: [
      "Remove a collaborator's explicit access to a customer.",
      "The primary owner cannot be removed.",
      "The customer is an ID, domain, or exact name; the member is a user ID or email.",
      "",
      "Removing your own access, or a former member's, is shown first. In a terminal you are",
      "asked to confirm; otherwise pass --yes, or nothing changes and the command exits 1.",
      "",
      "Example:",
      "  outlit customers revoke acme.com --member user_123 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...yesArg,
    ...customerCollaborationArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const target = parseCustomerCollaboration(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runConfirmedWrite(client, "outlit_set_customer_access", {
      input: { ...target, role: "none", requestId: newRequestId() },
      json,
      yes: args.yes === true,
      spinnerMessage: "Revoking customer access...",
      pending: readAccessConfirmation,
      confirmed: (previewToken) => ({
        ...target,
        role: "none",
        mode: "execute",
        previewToken,
        requestId: newRequestId(),
      }),
      question: "Remove this access?",
      unchanged: "Access was not changed",
    })
  },
})
