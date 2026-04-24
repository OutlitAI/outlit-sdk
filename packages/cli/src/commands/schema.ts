import { customerToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"

const publicSqlViews = ["activity", "customers", "users", "revenue"]

export default defineCommand({
  meta: {
    name: "schema",
    description: [
      "Describe the analytics database schema.",
      "",
      "Without a view name, returns the full schema for all views.",
      "With a view name, returns detailed column info for that view.",
      "",
      `Available views: ${publicSqlViews.join(", ")}`,
      "",
      "Examples:",
      "  outlit schema",
      "  outlit schema activity",
      "  outlit schema customers --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    table: {
      type: "positional",
      description: `View to describe (${publicSqlViews.join(", ")}). Optional.`,
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
