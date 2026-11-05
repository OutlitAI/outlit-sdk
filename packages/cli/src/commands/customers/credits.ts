import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { customerArgs, requireCustomerSelector } from "../../args/customer"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "credits",
    description: [
      "Read imported credit pools and burn summaries for one authorized customer.",
      "Unavailable or stale observations remain distinct from a zero balance.",
      "",
      "The customer (<customer> or --customer) accepts a customer domain, UUID, or exact name.",
      "",
      "Example:",
      "  outlit customers credits acme.com --json",
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
    const customer = requireCustomerSelector(args, "outlit customers credits", json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_get_customer_credits.toolName,
      { customer },
      json,
      { spinnerMessage: "Loading customer credits..." },
    )
  },
})
