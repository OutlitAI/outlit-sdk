import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
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
      "  outlit search 'budget' --doc-types fact,email_chunk",
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
    "doc-types": {
      type: "string",
      description: "Comma-separated document types to filter: fact, email_chunk, transcript_chunk",
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
    const topK = Number(args["top-k"])
    if (!Number.isFinite(topK) || topK <= 0) {
      return outputError(
        { message: "--top-k must be a positive number", code: "invalid_input" },
        json,
      )
    }

    const sourceType = args["source-type"]
    const sourceId = args["source-id"]
    const sourceTypes = args["source-types"]

    // sourceType and sourceId must be provided together
    if ((sourceType && !sourceId) || (!sourceType && sourceId)) {
      return outputError(
        {
          message: "--source-type and --source-id must be provided together",
          code: "invalid_input",
        },
        json,
      )
    }

    // query OR (sourceType + sourceId) required
    if (!args.query && !sourceType) {
      return outputError(
        {
          message: "A query argument or --source-type and --source-id are required",
          code: "invalid_input",
        },
        json,
      )
    }

    // sourceTypes cannot be combined with exact sourceType/sourceId lookup
    if (sourceTypes && sourceType) {
      return outputError(
        {
          message: "--source-types cannot be combined with --source-type/--source-id",
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    const parseCsv = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

    const params: Record<string, unknown> = { topK }
    if (args.query) params.query = args.query
    if (args.customer) params.customer = args.customer
    if (args.after) params.occurredAfter = args.after
    if (args.before) params.occurredBefore = args.before
    if (args["doc-types"]) params.docTypes = parseCsv(args["doc-types"])
    if (sourceTypes) params.sourceTypes = parseCsv(sourceTypes)
    if (sourceType) params.sourceType = sourceType
    if (sourceId) params.sourceId = sourceId

    return runTool(client, "outlit_search_customer_context", params, json)
  },
})
