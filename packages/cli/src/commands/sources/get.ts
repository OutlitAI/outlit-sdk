import {
  customerSourceTypeAliases,
  customerSourceTypeInputs,
  customerSourceTypes,
  customerToolContracts,
  normalizeCustomerSourceType,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

const sourceTypeDescription = `${customerSourceTypes.join(", ")} (aliases: ${customerSourceTypeAliases.join(", ")})`

function parseLimit(value: string | undefined, json: boolean): number | undefined {
  if (!value) return undefined

  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    outputError(
      {
        message: `--limit must be an integer between 1 and 100 (got: ${value})`,
        code: "invalid_input",
      },
      json,
    )
  }

  return limit
}

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact source by source type and source id.",
      "Returns the same normalized source envelope as `sources list`, with more detailed source-specific fields when available.",
      "For Slack, --source-id is Outlit's canonical root-message ID—not a Slack timestamp; replies are chronological per page, newest page first, and --cursor walks backward.",
      "",
      "Examples:",
      "  outlit sources get --source-type CALL --source-id call_123",
      "  outlit sources get --source-type OPPORTUNITY --source-id opp_123",
      "  outlit sources get --source-type SLACK --source-id root_123 --limit 25",
      "  outlit sources get --source-type SUPPORT_TICKET --source-id ticket_456 --json",
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
      description: "Slack replies per page (1-100). Default: 50. Ignored for other source types.",
    },
    cursor: {
      type: "string",
      description: "Opaque Slack reply cursor from record.pageInfo.nextCursor",
    },
  },
  async run({ args }) {
    const json = !!args.json

    const sourceType = normalizeCustomerSourceType(args["source-type"])
    if (!sourceType) {
      return outputError(
        {
          message: `--source-type must be one of ${customerSourceTypeInputs.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const limit = parseLimit(args.limit, json)
    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = {
      sourceType,
      sourceId: args["source-id"],
    }
    if (limit !== undefined) params.limit = limit
    if (args.cursor) params.cursor = args.cursor

    return runTool(client, customerToolContracts.outlit_get_source.toolName, params, json)
  },
})
