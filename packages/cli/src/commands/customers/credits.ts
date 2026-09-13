import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "credits",
    description: [
      "Read imported credit pools and burn summaries for one authorized customer.",
      "Unavailable or stale observations remain distinct from a zero balance.",
      "",
      "The customer argument accepts a customer domain, UUID, or exact name.",
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
    customer: {
      type: "positional",
      description: "Customer ID, domain (acme.com), or exact name",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_get_customer_credits.toolName,
      { customer: requiredTrimmedString(args.customer, "<customer>", json) },
      json,
      { spinnerMessage: "Loading customer credits..." },
    )
  },
})
