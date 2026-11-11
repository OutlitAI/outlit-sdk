import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { parseCsvList, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      publicToolContracts.outlit_get_identity.description,
      "",
      "Usage: outlit identity get <customer> [--include links] --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customer: { type: "positional", description: "Customer ID, domain or name", required: true },
    include: {
      type: "string",
      description: "Extras to read: links, the customer's records in other systems",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const customer = requiredTrimmedString(args.customer, "<customer>", json)
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
