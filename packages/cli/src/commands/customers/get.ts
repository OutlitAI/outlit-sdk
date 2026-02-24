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
      'Naming note: --include users returns data under the "contacts" key in',
      "the response. This is a server-side naming inconsistency, not a CLI bug.",
      "",
      "Examples:",
      "  outlit customers get acme.com",
      "  outlit customers get acme.com --include users,revenue",
      "  outlit customers get acme.com --include users,revenue,recentTimeline --timeframe 90d",
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
        "Available: users, revenue, recentTimeline, behaviorMetrics",
        'Note: "users" maps to "contacts" in the response (server naming).',
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
      params.include = splitCsv(args.include)
    }

    return runTool(client, "outlit_get_customer", params, json)
  },
})
