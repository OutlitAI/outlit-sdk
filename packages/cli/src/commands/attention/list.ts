import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

const statuses = ["open", "resolved"] as const

function isOneOf<TValue extends string>(
  values: readonly TValue[],
  value: string | undefined,
): value is TValue {
  return value !== undefined && values.includes(value as TValue)
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List authorized open or resolved Attention items.",
      "",
      "The response is bounded and includes current priority, lifecycle, customer identity,",
      "Core-owned ARR importance, and a prepared-action URL when review is available. It does not include email drafts,",
      "evidence identifiers, raw source-quote fields, or internal agent state.",
      "",
      "Examples:",
      "  outlit attention list",
      "  outlit attention list --status resolved",
      "  outlit attention list --customer-id 550e8400-e29b-41d4-a716-446655440000 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    status: {
      type: "string",
      description: "Lifecycle filter: open or resolved (Core default: open)",
    },
    "customer-id": {
      type: "string",
      description: "Filter by exact customer UUID",
    },
    limit: {
      type: "string",
      description: "Results per page (1-100; Core default: 25)",
    },
    cursor: {
      type: "string",
      description: "Opaque cursor from a previous response with the same filters",
    },
  },
  async run({ args }) {
    const json = !!args.json
    if (args.status !== undefined && !isOneOf(statuses, args.status)) {
      return outputError(
        { message: `--status must be one of: ${statuses.join(", ")}`, code: "invalid_input" },
        json,
      )
    }
    const params: Record<string, unknown> = {}
    if (args.status) params.status = args.status
    if (args["customer-id"]) params.customerId = args["customer-id"]
    if (args.limit) {
      const limit = Number(args.limit)
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return outputError(
          { message: "--limit must be an integer between 1 and 100", code: "invalid_input" },
          json,
        )
      }
      params.limit = limit
    }
    if (args.cursor) params.cursor = args.cursor

    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_list_attention_items.toolName, params, json)
  },
})
