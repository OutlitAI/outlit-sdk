import { customerIncludeSections, customerTimeframes, publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"

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
      'The primary record is returned under "customer". Each included section (such as "users")',
      "is {status, asOf, data}, or a status and reason when there is nothing to show.",
      "",
      `Available include sections: ${customerIncludeSections.join(", ")}`,
      `Timeframes: ${customerTimeframes.join(", ")}`,
      "",
      "Examples:",
      "  outlit customers get acme.com",
      "  outlit customers get acme.com --include users,revenue",
      "  outlit customers get acme.com --include users,revenue,recentTimeline --timeframe 90d",
      "  outlit customers get acme.com --include billing --subscriptions all",
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
        `Available: ${customerIncludeSections.join(", ")}`,
        'Included sections use their contract keys, such as "users" and "revenue".',
      ].join("\n"),
    },
    timeframe: {
      type: "string",
      description: "Timeframe for metrics (7d, 14d, 30d, 90d)",
      default: "30d",
    },
    subscriptions: {
      type: "string",
      description:
        "With --include billing: live (default) or all, which adds the most recently canceled subscriptions",
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
      params.include = splitCsv(args.include)
    }
    if (args.subscriptions) {
      params.subscriptions = args.subscriptions
    }

    return runTool(client, publicToolContracts.outlit_get_customer.toolName, params, json)
  },
})
