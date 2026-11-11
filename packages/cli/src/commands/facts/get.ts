import { customerFactIncludes, publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
import { outputError } from "../../lib/output"

function parseCsvArg(value?: string): string[] | undefined {
  if (!value) return undefined

  const items = splitCsv(value)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact fact by ID.",
      "",
      "Returns the fact with its customer. Use --include evidence to list every source the fact cites.",
      "",
      "Examples:",
      "  outlit facts get fact_123",
      "  outlit facts get fact_123 --include evidence",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Fact ID to fetch",
      required: true,
    },
    include: {
      type: "string",
      description: "Comma-separated expansions (evidence)",
    },
  },
  async run({ args }) {
    const json = !!args.json

    const params: Record<string, unknown> = {
      factId: args.id.trim(),
    }

    const include = parseCsvArg(args.include)
    // The tool is strict about `include`, so an unknown value is refused here with the allowed ones.
    const unknownIncludes = include?.filter(
      (value) => !(customerFactIncludes as readonly string[]).includes(value),
    )
    if (unknownIncludes && unknownIncludes.length > 0) {
      return outputError(
        {
          message: `Unknown include values: ${unknownIncludes.join(", ")}. Allowed: ${customerFactIncludes.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }
    if (include) params.include = include

    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, publicToolContracts.outlit_get_fact.toolName, params, json)
  },
})
