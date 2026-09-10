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
      publicToolContracts.outlit_get_customer_identity.description,
      "",
      "Usage: outlit customers identity <customerId> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customerId: { type: "positional", description: "Exact customer ID", required: true },
  },
  async run({ args }) {
    const json = !!args.json
    const customerId = requiredTrimmedString(args.customerId, "<customerId>", json)
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_get_customer_identity.toolName,
      { customerId },
      json,
    )
  },
})
