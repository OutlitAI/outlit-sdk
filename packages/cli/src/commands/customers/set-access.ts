import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { newIdempotencyKey } from "../../lib/idempotency-key"
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
      "the command exits 1. A change that needs confirming returns a preview.token: send it",
      "with --mode execute --preview-token <token>. To reverse a change, pass --undo-token.",
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
    const write = parseWriteMode(args, json, { executeOnly: true })
    const undoToken = readUndoToken(args)
    if (undoToken) {
      const client = await getClientOrExit(args["api-key"], json)
      return runTool(
        client,
        "outlit_set_customer_access",
        { undoToken, idempotencyKey: write.idempotencyKey },
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
        { ...target, role, ...write.explicit, idempotencyKey: write.idempotencyKey },
        json,
        { spinnerMessage: "Changing customer access..." },
      )
    }

    return runConfirmedWrite(client, "outlit_set_customer_access", {
      input: { ...target, role, idempotencyKey: write.idempotencyKey },
      json,
      yes: args.yes === true,
      spinnerMessage: "Changing customer access...",
      pending: readAccessConfirmation,
      confirmed: (previewToken) => ({
        ...target,
        role,
        mode: "execute",
        previewToken,
        idempotencyKey: newIdempotencyKey(),
      }),
      question: role === "none" ? "Remove this access?" : "Change this access?",
      unchanged: "Access was not changed",
    })
  },
})
