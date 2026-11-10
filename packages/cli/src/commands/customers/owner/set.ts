import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit } from "../../../lib/api"
import { runConfirmedWrite, yesArg } from "../../../lib/confirm"
import { newRequestId } from "../../../lib/request-id"
import { customerCollaborationArgs, parseCustomerCollaboration } from "../collaboration-input"

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
    name: "set",
    description: [
      "Assign an active workspace member as a customer's primary owner.",
      "The former owner keeps Editor access.",
      "The customer is an ID, domain, or exact name; the member is a user ID or email.",
      "",
      "Outlit first shows the change. In a terminal you are asked to confirm; otherwise pass",
      "--yes, or nothing changes and the command exits 1.",
      "",
      "Example:",
      "  outlit customers owner set acme.com --member user_123 --yes --json",
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

    return runConfirmedWrite(client, "outlit_set_customer_owner", {
      input: { ...target, requestId: newRequestId() },
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
