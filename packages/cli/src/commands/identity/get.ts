import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { customerArgs, requireCustomerSelector } from "../../args/customer"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { parseCsvList } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      publicToolContracts.outlit_get_identity.description,
      "",
      "Usage: outlit identity get <customer> [--include links] --json",
      "The customer (<customer> or --customer) accepts a customer domain, exact name, or ID.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...customerArgs,
    include: {
      type: "string",
      description: "Extras to read: links, the customer's records in other systems",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const customer = requireCustomerSelector(args, "outlit identity get", json)
    const include = parseCsvList(args.include).map((value) => value.toLowerCase())
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_get_identity.toolName,
      { customer, ...(include.length > 0 ? { include } : {}) },
      json,
    )
  },
})
