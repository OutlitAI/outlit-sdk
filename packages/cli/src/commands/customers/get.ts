import { customerTimeframes, publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { customerSections, parseCustomerSections } from "../../args/customer-sections"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get details for a customer by ID, domain, or name.",
      "",
      "The customer argument accepts:",
      "  - Customer domain (acme.com)",
      "  - Customer ID (UUID)",
      "  - Customer name (partial match)",
      "",
      'The primary record is returned under "customer". --include users adds "users".',
      "",
      `Available include sections: ${customerSections.join(", ")}`,
      `Timeframes: ${customerTimeframes.join(", ")}`,
      "",
      "Examples:",
      "  outlit customers get acme.com",
      "  outlit customers get acme.com --include users,revenue",
      "  outlit customers get acme.com --include balances",
      "  outlit customers get acme.com --include users,revenue,activity --timeframe 90d",
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
    include: {
      type: "string",
      description: [
        "Comma-separated sections to include in response.",
        `Available: ${customerSections.join(", ")}`,
        "Balances include credits and metered feature allowances. JSON retains API response keys.",
      ].join("\n"),
    },
    timeframe: {
      type: "string",
      description: "Timeframe for metrics (7d, 14d, 30d, 90d)",
      default: "30d",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {
      customer: args.customer,
      timeframe: args.timeframe,
    }

    if (args.include) {
      params.include = parseCustomerSections(args.include)
    }

    return runTool(client, publicToolContracts.outlit_get_customer.toolName, params, json)
  },
})
