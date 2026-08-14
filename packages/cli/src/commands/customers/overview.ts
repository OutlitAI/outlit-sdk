import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "overview",
    description: [
      "Get the bounded relationship context for a customer.",
      "",
      "Returns the durable customer-detail read model: a relationship-context headline, up to eight",
      "categorized current statements, ISO observed-at timestamps when supported, source labels, and",
      "a provenance marker. It does not expand the compact customer get response, expose raw fact IDs",
      "or source quotes, or replace the chronological timeline.",
      "",
      "The customer argument accepts:",
      "  - Customer domain (acme.com)",
      "  - Customer ID (UUID)",
      "  - Exact customer name",
      "",
      "Examples:",
      "  outlit customers overview acme.com",
      "  outlit customers overview acme.com --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customer: {
      type: "positional",
      description: "Customer ID, domain (acme.com), or name",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_get_customer_overview.toolName,
      { customer: args.customer },
      json,
    )
  },
})
