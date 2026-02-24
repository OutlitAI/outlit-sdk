import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { applyPagination, paginationArgs } from "../args/pagination"
import { getClientOrExit, runTool } from "../lib/api"

export default defineCommand({
  meta: {
    name: "facts",
    description: [
      "Retrieve facts for a customer.",
      "",
      "Returns a list of facts (signals, events, and derived insights) for the",
      "specified customer within the given timeframe.",
      "",
      "Examples:",
      "  outlit facts acme.com",
      "  outlit facts acme.com --timeframe 90d",
      "  outlit facts acme.com --limit 50 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    customer: {
      type: "positional",
      description: "Customer UUID or domain to retrieve facts for",
      required: true,
    },
    timeframe: {
      type: "string",
      description: "Lookback window (e.g. 7d, 30d, 90d). Default: 30d.",
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
    applyPagination(params, args, json)

    return runTool(client, "outlit_get_facts", params, json)
  },
})
