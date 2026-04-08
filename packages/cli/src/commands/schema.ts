import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { customerToolContracts, schemaTables } from "../generated/tool-contracts"
import { getClientOrExit, runTool } from "../lib/api"

export default defineCommand({
  meta: {
    name: "schema",
    description: [
      "Describe the analytics database schema.",
      "",
      "Without a table name, returns the full schema for all tables.",
      "With a table name, returns detailed column info for that table.",
      "",
      `Available tables: ${schemaTables.join(", ")}`,
      "",
      "Examples:",
      "  outlit schema",
      "  outlit schema events",
      "  outlit schema customer_dimensions --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    table: {
      type: "positional",
      description: `Table to describe (${schemaTables.join(", ")}). Optional.`,
      required: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args.table) params.table = args.table

    return runTool(client, customerToolContracts.outlit_schema.toolName, params, json)
  },
})
