import { publicToolContracts, sourceTypes as toolSourceTypes } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { toWireSourceTypes } from "../../lib/source-types"

/** A memory entry a fact cites; only the exact lookup opens it. */
const EXTRACTED = "extracted"
const sourceTypeDescription = [...toolSourceTypes, EXTRACTED].join(", ")

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact source by source type and source id: the `source {type, id}` another command returned.",
      "Returns the same normalized source envelope as `sources list`, with its content a page of segments at a time.",
      "",
      "Examples:",
      "  outlit sources get --source-type call --source-id call_123",
      "  outlit sources get --source-type slack --source-id thread_123 --limit 50",
      "  outlit sources get --source-type opportunity --source-id opp_123",
      "  outlit sources get --source-type support_ticket --source-id ticket_456 --json",
      "",
      `Source types: ${sourceTypeDescription}`,
      "Use `outlit sources list` when you need deterministic enumeration rather than exact lookup.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "source-type": {
      type: "string",
      description: `Source type (${sourceTypeDescription})`,
      required: true,
    },
    "source-id": {
      type: "string",
      description: "Exact source id",
      required: true,
    },
    limit: {
      type: "string",
      description: publicToolContracts.outlit_get_source.inputSchema.properties.limit.description,
    },
    cursor: {
      type: "string",
      description: publicToolContracts.outlit_get_source.inputSchema.properties.cursor.description,
    },
  },
  async run({ args }) {
    const json = !!args.json

    // Any case is accepted, and the previously published aliases (CRM, STRIPE_INVOICE).
    const requested = args["source-type"].trim()
    const sourceType =
      requested.toLowerCase() === EXTRACTED
        ? EXTRACTED
        : (() => {
            const result = toWireSourceTypes([requested], { sourceTools: true })
            return result.ok ? result.types[0] : undefined
          })()
    if (!sourceType) {
      return outputError(
        {
          message: `--source-type must be one of ${sourceTypeDescription}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const limit = args.limit ? Number(args.limit) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      return outputError(
        {
          message: `--limit must be an integer between 1 and 100 (got: ${args.limit})`,
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_get_source.toolName,
      {
        source: { type: sourceType, id: args["source-id"] },
        ...(limit !== undefined ? { limit } : {}),
        ...(args.cursor ? { cursor: args.cursor } : {}),
      },
      json,
    )
  },
})
