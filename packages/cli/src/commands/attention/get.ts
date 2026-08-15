import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one authorized Attention item by exact ID.",
      "",
      "Returns the bounded current assessment, timeline, evidence summaries, Core-owned ARR",
      "importance, and a prepared-action URL when review is available. It does not expose email drafts, evidence IDs,",
      "raw source-quote fields, or internal agent state.",
      "",
      "Examples:",
      "  outlit attention get 550e8400-e29b-41d4-a716-446655440000",
      "  outlit attention get 550e8400-e29b-41d4-a716-446655440000 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Exact Attention item UUID",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_get_attention_item.toolName,
      { id: args.id },
      json,
    )
  },
})
