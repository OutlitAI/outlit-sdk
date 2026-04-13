import {
  customerSourceTypes,
  customerToolContracts,
  resolveCustomerContextSearchInput,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { splitCsv } from "../lib/config"
import { outputError } from "../lib/output"

export default defineCommand({
  meta: {
    name: "search",
    description: [
      "Search customer context using natural language.",
      "",
      "Performs a semantic search over grouped source and fact results.",
      "Optionally scope to a specific customer with --customer.",
      "",
      "Examples:",
      "  outlit search 'pricing objections last quarter'",
      "  outlit search 'churn risk signals' --customer acme.com",
      "  outlit search 'expansion opportunities' --top-k 50 --json",
      "  outlit search 'support escalations' --after 2025-01-01T00:00:00Z --before 2025-03-31T23:59:59Z",
      "  outlit search 'onboarding issues' --source-types CALL,EMAIL",
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
      description: "Maximum number of results to return (1–50). Default: 20.",
    },
    after: {
      type: "string",
      description:
        "Filter to events occurring after this datetime (ISO 8601, e.g. 2025-01-01T00:00:00Z)",
    },
    before: {
      type: "string",
      description:
        "Filter to events occurring before this datetime (ISO 8601, e.g. 2025-03-31T23:59:59Z)",
    },
    "source-types": {
      type: "string",
      description: `Comma-separated generic source type filter (${customerSourceTypes.join(", ")})`,
    },
  },
  async run({ args }) {
    const json = !!args.json

    // Validate arguments before authenticating
    const topK = args["top-k"] ? Number(args["top-k"]) : undefined
    if (
      topK !== undefined &&
      (!Number.isFinite(topK) || !Number.isInteger(topK) || topK < 1 || topK > 50)
    ) {
      return outputError(
        { message: "--top-k must be an integer between 1 and 50", code: "invalid_input" },
        json,
      )
    }

    const sourceTypes = args["source-types"]
      ? splitCsv(args["source-types"])
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined

    const invalidSourceTypes = sourceTypes?.filter(
      (value) => !customerSourceTypes.includes(value as (typeof customerSourceTypes)[number]),
    )
    if (invalidSourceTypes && invalidSourceTypes.length > 0) {
      return outputError(
        {
          message: `Unknown source types: ${invalidSourceTypes.join(", ")}. Allowed: ${customerSourceTypes.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const resolved = resolveCustomerContextSearchInput({
      query: args.query,
      customer: args.customer,
      topK,
      after: args.after,
      before: args.before,
      sourceTypes,
    })

    if (!resolved.ok) {
      return outputError(
        {
          message: resolved.message,
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      customerToolContracts.outlit_search_customer_context.toolName,
      resolved.request,
      json,
    )
  },
})
