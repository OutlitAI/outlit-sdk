import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
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
      "Available tables: events, customer_dimensions, user_dimensions, mrr_snapshots",
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
      description:
        "Table to describe (events, customer_dimensions, user_dimensions, mrr_snapshots). Optional.",
      required: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {}
    if (args.table) params.table = args.table

    return runTool(client, "outlit_schema", params, json)
  },
})
