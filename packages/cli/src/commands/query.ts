import { readFileSync } from "node:fs"
import { schemaTables } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { errorMessage, outputError } from "../lib/output"

export default defineCommand({
  meta: {
    name: "query",
    description: [
      "Run a SQL query against Outlit analytics views.",
      "",
      "Provide the query as a positional argument or via --query-file.",
      "When both are provided, --query-file takes precedence.",
      "",
      "Run `outlit schema get` first: it lists every column with its unit and currency, and worked queries.",
      "The query runs once and its first 10,000 rows are kept for an hour; the result's page.nextCursor",
      "reads the next page when sent back with --cursor and the same query.",
      "",
      `Available views: ${schemaTables.join(", ")}`,
      "",
      "Examples:",
      "  outlit query 'SELECT * FROM activity LIMIT 10'",
      "  outlit query --query-file ./my-query.sql",
      "  outlit query 'SELECT count(*) FROM activity' --limit 1 --json",
      "  outlit query 'SELECT * FROM activity' --limit 500 --cursor <page.nextCursor>",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    query: {
      type: "positional",
      description: "SQL query string to execute",
      required: false,
    },
    "query-file": {
      type: "string",
      description: "Path to a .sql file to read the query from (takes precedence over positional)",
    },
    limit: {
      type: "string",
      description: "Rows per page (1-1000). Default: 100.",
      default: "100",
    },
    cursor: {
      type: "string",
      description: "page.nextCursor from the previous page of the same query",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    let sql: string

    if (args["query-file"]) {
      try {
        sql = readFileSync(args["query-file"], "utf-8")
      } catch (err) {
        return outputError(
          {
            message: `Cannot read file: ${errorMessage(err, "unknown error")}`,
            code: "file_error",
          },
          json,
        )
      }
    } else if (args.query) {
      sql = args.query
    } else {
      return outputError(
        { message: "Provide a SQL query or --query-file", code: "missing_input" },
        json,
      )
    }

    const limit = Number(args.limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      return outputError(
        { message: "--limit must be an integer between 1 and 1000", code: "invalid_input" },
        json,
      )
    }

    return runTool(
      client,
      "outlit_query",
      { sql, limit, ...(args.cursor ? { cursor: args.cursor } : {}) },
      json,
    )
  },
})
