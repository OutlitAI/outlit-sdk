import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { newRequestId } from "../../lib/request-id"
import { parseWriteMode, writeModeArgs } from "../../lib/write-mode"
import { readAccessConfirmation } from "./access-confirmation"
import {
  customerAccessRoleArg,
  customerCollaborationArgs,
  parseCustomerAccessRole,
  parseCustomerCollaboration,
  readUndoToken,
} from "./collaboration-input"

export default defineCommand({
  meta: {
    name: "set-access",
    description: [
      "Grant, change or remove a workspace member's access to a customer.",
      "--role viewer or editor grants or changes it; --role none removes explicit access.",
      "The primary owner cannot be removed; use `customers set-owner` to change the owner.",
      "The customer is an ID, domain, or exact name; the member is a user ID or email.",
      "Take members from `outlit members list`.",
      "",
      "A change you could not undo, such as reducing your own access, is shown first.",
      "In a terminal you are asked to confirm; otherwise pass --yes, or nothing changes and",
      "the command exits 1. For two explicit steps, run with --mode preview, then with",
      "--mode execute and its --preview-token. To reverse a change, pass --undo-token.",
      "",
      "Examples:",
      "  outlit customers set-access acme.com --member user_123 --role viewer --json",
      "  outlit customers set-access acme.com --member user_123 --role none --yes --json",
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
    ...writeModeArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const write = parseWriteMode(args, json)
    const undoToken = readUndoToken(args)
    if (undoToken) {
      const client = await getClientOrExit(args["api-key"], json)
      return runTool(
        client,
        "outlit_set_customer_access",
        { undoToken, requestId: write.requestId },
        json,
        { spinnerMessage: "Undoing the access change..." },
      )
    }

    const target = parseCustomerCollaboration(args, json)
    const role = parseCustomerAccessRole(args.role, json)
    const client = await getClientOrExit(args["api-key"], json)

    if (write.explicit) {
      return runTool(
        client,
        "outlit_set_customer_access",
        { ...target, role, ...write.explicit, requestId: write.requestId },
        json,
        { spinnerMessage: "Changing customer access..." },
      )
    }

    return runConfirmedWrite(client, "outlit_set_customer_access", {
      input: { ...target, role, requestId: write.requestId },
      json,
      yes: args.yes === true,
      spinnerMessage: "Changing customer access...",
      pending: readAccessConfirmation,
      confirmed: (previewToken) => ({
        ...target,
        role,
        mode: "execute",
        previewToken,
        requestId: newRequestId(),
      }),
      question: role === "none" ? "Remove this access?" : "Change this access?",
      unchanged: "Access was not changed",
    })
  },
})
