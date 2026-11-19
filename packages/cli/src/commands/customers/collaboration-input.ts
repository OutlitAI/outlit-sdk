import { publicToolContracts } from "@outlit/tools"
import {
  CUSTOMER_SELECTOR_HINT,
  type CustomerSelectorArgs,
  customerFlagArgs,
  requireCustomerSelector,
} from "../../args/customer"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredString } from "../../lib/platform-input"
import { labeledPositional } from "../../lib/strict-args"

const memberMaxLength =
  publicToolContracts.outlit_set_customer_access.inputSchema.properties.member.maxLength

/** What `outlit customers set-access` sets; `none` removes explicit access. */
export const customerAccessRoles = ["viewer", "editor", "none"] as const

export const customerCollaborationArgs = {
  customerPositional: labeledPositional("customer", {
    type: "positional",
    description: `${CUSTOMER_SELECTOR_HINT}; same as --customer`,
    // Optional so that --undo-token can reverse an earlier change without naming it again.
    required: false,
  }),
  ...customerFlagArgs,
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
  args: CustomerSelectorArgs & { member?: string },
  command: string,
  json: boolean,
): { customer: string; member: string } {
  const customer = requireCustomerSelector(args, command, json)
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
