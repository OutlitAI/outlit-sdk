import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "identity",
    description: [
      publicToolContracts.outlit_get_identity.description,
      "",
      "Usage: outlit customers identity <customerId> [--links] --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customerId: { type: "positional", description: "Customer ID, domain or name", required: true },
    links: {
      type: "boolean",
      description: "Also list the customer's records in other systems",
      default: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const customerId = requiredTrimmedString(args.customerId, "<customerId>", json)
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_get_identity.toolName,
      { customer: customerId, ...(args.links === true ? { include: ["links"] } : {}) },
      json,
    )
  },
})
