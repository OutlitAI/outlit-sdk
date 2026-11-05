import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { customerArgs, requireCustomerSelector, resolveCustomerIdOrExit } from "../../args/customer"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "identity",
    description: [
      publicToolContracts.outlit_get_customer_identity.description,
      "",
      "Usage: outlit customers identity <customer> --json",
      "The customer (<customer> or --customer) accepts a customer domain, exact name, or ID.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...customerArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const customer = requireCustomerSelector(args, "outlit customers identity", json)
    const client = await getClientOrExit(args["api-key"], json)
    const customerId = await resolveCustomerIdOrExit(client, customer, json)
    return runTool(
      client,
      publicToolContracts.outlit_get_customer_identity.toolName,
      { customerId },
      json,
    )
  },
})
