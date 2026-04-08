import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import {
  customerToolContracts,
  resolveCustomerContextSearchRequest,
} from "../generated/tool-contracts"
import { getClientOrExit, runTool } from "../lib/api"
import { outputError } from "../lib/output"

export default defineCommand({
  meta: {
    name: "search",
    description: [
      "Search customer context using natural language or direct source lookup.",
      "",
      "Performs a semantic search over customer facts, emails, and transcripts.",
      "Optionally scope to a specific customer with --customer.",
      "Use --source-type and --source-id for direct source lookup (query becomes optional).",
      "",
      "Examples:",
      "  outlit search 'pricing objections last quarter'",
      "  outlit search 'churn risk signals' --customer acme.com",
      "  outlit search 'expansion opportunities' --top-k 50 --json",
      "  outlit search 'support escalations' --after 2025-01-01 --before 2025-03-31",
      "  outlit search 'onboarding issues' --source-types call_transcript,email",
      "  outlit search --source-type call_transcript --source-id call_123",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    query: {
      type: "positional",
      description:
        "Natural language search query. Optional when --source-type and --source-id are provided.",
      required: false,
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
      description: "Filter to events occurring after this date (ISO 8601, e.g. 2025-01-01)",
    },
    before: {
      type: "string",
      description: "Filter to events occurring before this date (ISO 8601, e.g. 2025-03-31)",
    },
    "source-types": {
      type: "string",
      description: "Comma-separated broad source type filter",
    },
    "source-type": {
      type: "string",
      description: "Exact source type for direct lookup (must pair with --source-id)",
    },
    "source-id": {
      type: "string",
      description: "Exact source ID for direct lookup (must pair with --source-type)",
    },
  },
  async run({ args }) {
    const json = !!args.json

    // Validate arguments before authenticating
    const topK = args["top-k"] ? Number(args["top-k"]) : undefined
    if (topK !== undefined && (!Number.isFinite(topK) || topK < 1 || topK > 50)) {
      return outputError(
        { message: "--top-k must be an integer between 1 and 50", code: "invalid_input" },
        json,
      )
    }

    const sourceTypes = args["source-types"]

    const parseCsv = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

    const resolved = resolveCustomerContextSearchRequest({
      query: args.query,
      customer: args.customer,
      topK,
      occurredAfter: args.after,
      occurredBefore: args.before,
      sourceTypes: sourceTypes ? parseCsv(sourceTypes) : undefined,
      sourceType: args["source-type"],
      sourceId: args["source-id"],
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

    const params: Record<string, unknown> =
      resolved.request.kind === "exact_lookup"
        ? resolved.request.exactLookup
        : resolved.request.search

    return runTool(
      client,
      customerToolContracts.outlit_search_customer_context.toolName,
      params,
      json,
    )
  },
})
