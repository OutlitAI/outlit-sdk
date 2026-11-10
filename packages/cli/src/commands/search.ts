import {
  publicToolContracts,
  resolveCustomerContextSearchInput,
  sourceTypes as toolSourceTypes,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { rawFlagValue } from "../args/filters"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { splitCsv } from "../lib/config"
import { outputError } from "../lib/output"

const sourceTypeDescription = toolSourceTypes.join(", ")

export default defineCommand({
  meta: {
    name: "search",
    description: [
      "Search customer context using natural language.",
      "",
      "Performs a semantic search over grouped source and fact results.",
      "Use `outlit sources list` when you need deterministic source enumeration rather than semantic ranking.",
      "Optionally scope to a specific customer with --customer.",
      "",
      "Examples:",
      "  outlit search 'pricing objections last quarter'",
      "  outlit search 'churn risk signals' --customer acme.com",
      "  outlit search 'expansion opportunities' --limit 50 --json",
      "  outlit search 'support escalations' --after 2025-01-01T00:00:00Z --before 2025-03-31T23:59:59Z",
      "  outlit search 'renewal opportunities' --source-types call,opportunity",
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
    limit: {
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
      description: `Comma-separated generic source type filter (${sourceTypeDescription})`,
    },
  },
  async run({ args, rawArgs }) {
    const json = !!args.json

    // Validate arguments before authenticating. --top-k is the previously published spelling of
    // --limit: still accepted from the raw arguments, but no longer declared or advertised.
    const flag = args.limit === undefined ? "top-k" : "limit"
    const rawLimit = args.limit ?? rawFlagValue(rawArgs, "top-k")
    const limit = rawLimit === undefined ? undefined : Number(rawLimit)
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
      return outputError(
        { message: `--${flag} must be an integer between 1 and 50`, code: "invalid_input" },
        json,
      )
    }

    const sourceTypes = args["source-types"]
      ? splitCsv(args["source-types"])
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined

    const resolved = resolveCustomerContextSearchInput({
      query: args.query,
      customer: args.customer,
      limit,
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
      publicToolContracts.outlit_search_customer_context.toolName,
      resolved.request,
      json,
    )
  },
})
