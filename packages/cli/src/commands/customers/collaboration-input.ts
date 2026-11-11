import { publicToolContracts } from "@outlit/tools"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredString } from "../../lib/platform-input"

const memberMaxLength =
  publicToolContracts.outlit_set_customer_access.inputSchema.properties.member.maxLength

/** What `outlit customers set-access` sets; `none` removes explicit access. */
export const customerAccessRoles = ["viewer", "editor", "none"] as const

export const customerCollaborationArgs = {
  customer: {
    type: "positional",
    description: "Customer ID, domain (acme.com), or exact name",
    // Optional only so that --undo-token can reverse an earlier change without naming it again.
    required: false,
  },
  member: {
    type: "string",
    description: "Workspace member's user ID or email, from `outlit members list --json`",
  },
  "undo-token": {
    type: "string",
    description: "undo.token of an earlier change: reverses it",
  },
} as const

export const customerAccessRoleArg = {
  role: {
    type: "string",
    description: `New collaboration role (${customerAccessRoles.join(", ")}); none removes access`,
  },
} as const

/** The customer and member a collaboration write names, as the tool takes them. */
export function parseCustomerCollaboration(
  args: { customer?: string; member?: string },
  json: boolean,
): { customer: string; member: string } {
  const customer = requiredString(args.customer, "<customer>", json).trim()
  const member = args.member?.trim()
  if (!member) {
    return outputError({ message: "Provide --member", code: "missing_input" }, json)
  }
  if (member.length > memberMaxLength) {
    return outputError(
      { message: `--member must be at most ${memberMaxLength} characters`, code: "invalid_input" },
      json,
    )
  }

  return { customer, member }
}

/** The undo a collaboration write was asked to run, when --undo-token was given. */
export function readUndoToken(args: { "undo-token"?: string }): string | null {
  return optionalTrimmedString(args["undo-token"])
}

/** Reads --role in any case (VIEWER, Editor), the way it has always been typed. */
export function parseCustomerAccessRole(
  value: string | undefined,
  json: boolean,
): (typeof customerAccessRoles)[number] {
  const input = requiredString(value, "--role", json).trim().toLowerCase()
  const role = customerAccessRoles.find((candidate) => candidate === input)
  if (!role) {
    return outputError(
      {
        message: `--role must be one of: ${customerAccessRoles.join(", ")}`,
        code: "invalid_input",
      },
      json,
    )
  }

  return role
}
