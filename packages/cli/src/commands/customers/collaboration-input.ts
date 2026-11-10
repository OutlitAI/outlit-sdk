import { publicToolContracts } from "@outlit/tools"
import { outputError } from "../../lib/output"
import { requiredString } from "../../lib/platform-input"

const memberMaxLength =
  publicToolContracts.outlit_set_customer_access.inputSchema.properties.member.maxLength

/** What `outlit customers grant` sets; `revoke` is the same write with role none. */
export const customerAccessRoles = ["viewer", "editor"] as const

export const customerCollaborationArgs = {
  customer: {
    type: "positional",
    description: "Customer ID, domain (acme.com), or exact name",
    required: true,
  },
  member: {
    type: "string",
    description: "Workspace member's user ID or email, from `outlit ws-users list --json`",
  },
  "target-user-id": {
    type: "string",
    description: "Previous spelling of --member",
  },
} as const

export const customerAccessRoleArg = {
  role: {
    type: "string",
    description: `Required collaboration role (${customerAccessRoles.join(", ")})`,
  },
} as const

/** The customer and member a collaboration write names, as the tool takes them. */
export function parseCustomerCollaboration(
  args: { customer?: string; member?: string; "target-user-id"?: string },
  json: boolean,
): { customer: string; member: string } {
  const customer = requiredString(args.customer, "<customer>", json).trim()
  const member = (args.member ?? args["target-user-id"])?.trim()
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
