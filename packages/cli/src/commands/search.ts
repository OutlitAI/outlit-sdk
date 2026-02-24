import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { outputError } from "../lib/output"

export default defineCommand({
  meta: {
    name: "search",
    description: [
      "Search customer context using natural language.",
      "",
      "Performs a semantic search over customer events and signals.",
      "Optionally scope to a specific customer with --customer.",
      "",
      "Examples:",
      "  outlit search 'pricing objections last quarter'",
      "  outlit search 'churn risk signals' --customer acme.com",
      "  outlit search 'expansion opportunities' --top-k 50 --json",
      "  outlit search 'support escalations' --after 2025-01-01 --before 2025-03-31",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    query: {
      type: "positional",
      description: "Natural language search query",
      required: true,
    },
    customer: {
      type: "string",
      description: "Scope search to a specific customer (UUID or domain)",
    },
    "top-k": {
      type: "string",
      description: "Maximum number of results to return. Default: 20.",
      default: "20",
    },
    after: {
      type: "string",
      description: "Filter to events occurring after this date (ISO 8601, e.g. 2025-01-01)",
    },
    before: {
      type: "string",
      description: "Filter to events occurring before this date (ISO 8601, e.g. 2025-03-31)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const topK = Number(args["top-k"])
    if (!Number.isFinite(topK) || topK <= 0) {
      return outputError(
        { message: "--top-k must be a positive number", code: "invalid_input" },
        json,
      )
    }

    const params: Record<string, unknown> = {
      query: args.query,
      topK,
    }
    if (args.customer) params.customer = args.customer
    if (args.after) params.occurredAfter = args.after
    if (args.before) params.occurredBefore = args.before

    return runTool(client, "outlit_search_customer_context", params, json)
  },
})
