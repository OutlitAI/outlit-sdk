import { publicToolContracts } from "@outlit/tools"
import { outputError } from "../../lib/output"
import { requiredTrimmedString } from "../../lib/platform-input"

const customerIdSchema =
  publicToolContracts.outlit_assign_customer_owner.inputSchema.properties.customerId
const targetUserIdSchema =
  publicToolContracts.outlit_assign_customer_owner.inputSchema.properties.targetUserId

export const customerAccessRoles =
  publicToolContracts.outlit_grant_customer_access.inputSchema.properties.role.enum

export const customerCollaborationIdArgs = {
  "customer-id": {
    type: "positional",
    description: "Exact customer UUID",
    required: true,
  },
  "target-user-id": {
    type: "string",
    description: "Required exact workspace-user ID from `outlit ws-users list --json`",
  },
} as const

export const customerAccessRoleArg = {
  role: {
    type: "string",
    description: `Required collaboration role (${customerAccessRoles.join(", ")})`,
  },
} as const

export function parseCustomerCollaborationIds(
  args: { "customer-id"?: string; "target-user-id"?: string },
  json: boolean,
): { customerId: string; targetUserId: string } {
  const customerId = requiredTrimmedString(args["customer-id"], "<customer-id>", json)
  const customerIdPattern = new RegExp(customerIdSchema.pattern)
  if (!customerIdPattern.test(customerId)) {
    return outputError(
      { message: "<customer-id> must be an exact customer UUID", code: "invalid_input" },
      json,
    )
  }

  const targetUserId = requiredTrimmedString(args["target-user-id"], "--target-user-id", json)
  if (targetUserId.length > targetUserIdSchema.maxLength) {
    return outputError(
      {
        message: `--target-user-id must be at most ${targetUserIdSchema.maxLength} characters`,
        code: "invalid_input",
      },
      json,
    )
  }

  return { customerId, targetUserId }
}

export function parseCustomerAccessRole(
  value: string | undefined,
  json: boolean,
): (typeof customerAccessRoles)[number] {
  const normalized = requiredTrimmedString(value, "--role", json).toUpperCase()
  const role = customerAccessRoles.find((candidate) => candidate === normalized)
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
