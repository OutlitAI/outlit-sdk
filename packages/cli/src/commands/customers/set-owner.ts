import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { newRequestId } from "../../lib/request-id"
import { parseWriteMode, writeModeArgs } from "../../lib/write-mode"
import {
  customerCollaborationArgs,
  parseCustomerCollaboration,
  readUndoToken,
} from "./collaboration-input"

type OwnerResult = {
  outcome: string
  customer?: { name: string | null; domain: string | null }
  owner?: { name: string; email: string } | null
  newOwner?: { name: string; email: string }
  undo?: { available: boolean; reason?: string }
  preview?: { token: string }
}

function readOwnerPreview(result: unknown) {
  const data = result as OwnerResult
  if (data.outcome !== "previewed" || !data.preview) return null
  const customer = data.customer?.name ?? data.customer?.domain ?? "this customer"
  const lines = [
    `Make ${data.newOwner?.email ?? "the member"} the owner of ${customer}.`,
    data.owner
      ? `${data.owner.email} stops being the owner and becomes an editor.`
      : "The customer has no owner now.",
  ]
  if (data.undo?.available === false && data.undo.reason) lines.push(data.undo.reason)
  return { token: data.preview.token, lines }
}

export default defineCommand({
  meta: {
    name: "set-owner",
    description: [
      "Assign an active workspace member as a customer's primary owner.",
      "The former owner keeps Editor access.",
      "The customer is an ID, domain, or exact name; the member is a user ID or email.",
      "",
      "Outlit first shows the change. In a terminal you are asked to confirm; otherwise pass",
      "--yes, or nothing changes and the command exits 1. For two explicit steps, run with",
      "--mode preview, then with --mode execute and its --preview-token.",
      "To reverse a change, pass the undo.token it returned as --undo-token.",
      "",
      "Examples:",
      "  outlit customers set-owner acme.com --member user_123 --yes --json",
      "  outlit customers set-owner --undo-token <undo.token> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...yesArg,
    ...customerCollaborationArgs,
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
        "outlit_set_customer_owner",
        { undoToken, requestId: write.requestId },
        json,
        { spinnerMessage: "Undoing the owner change..." },
      )
    }

    const target = parseCustomerCollaboration(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    if (write.explicit) {
      return runTool(
        client,
        "outlit_set_customer_owner",
        { ...target, ...write.explicit, requestId: write.requestId },
        json,
        { spinnerMessage: "Assigning customer owner..." },
      )
    }

    return runConfirmedWrite(client, "outlit_set_customer_owner", {
      input: { ...target, requestId: write.requestId },
      json,
      yes: args.yes === true,
      spinnerMessage: "Assigning customer owner...",
      pending: readOwnerPreview,
      confirmed: (previewToken) => ({
        ...target,
        mode: "execute",
        previewToken,
        requestId: newRequestId(),
      }),
      question: "Change the owner?",
      unchanged: "The owner was not changed",
    })
  },
})
