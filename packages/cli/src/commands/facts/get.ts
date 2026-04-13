import { customerToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"

function parseCsvArg(value?: string): string[] | undefined {
  if (!value) return undefined

  const items = splitCsv(value)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact fact by ID.",
      "",
      "Use --include evidence to request best-effort evidence expansion.",
      "",
      "Examples:",
      "  outlit facts get --fact-id fact_123",
      "  outlit facts get --fact-id fact_123 --include evidence",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "fact-id": {
      type: "string",
      description: "Fact ID to fetch",
      required: true,
    },
    include: {
      type: "string",
      description: "Comma-separated best-effort expansions (for example: evidence)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {
      factId: args["fact-id"],
    }

    const include = parseCsvArg(args.include)
    if (include) params.include = include

    return runTool(client, customerToolContracts.outlit_get_fact.toolName, params, json)
  },
})
