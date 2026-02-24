import { readFileSync } from "node:fs"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { errorMessage, outputError } from "../lib/output"

export default defineCommand({
  meta: {
    name: "sql",
    description: [
      "Run a SQL query against Outlit's analytics database.",
      "",
      "Provide the query as a positional argument or via --query-file.",
      "When both are provided, --query-file takes precedence.",
      "",
      "Available tables: events, customer_dimensions, user_dimensions, mrr_snapshots",
      "",
      "Examples:",
      "  outlit sql 'SELECT * FROM events LIMIT 10'",
      "  outlit sql --query-file ./my-query.sql",
      "  outlit sql 'SELECT count(*) FROM events' --limit 1 --json",
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
      description: "Maximum number of rows to return. Default: 1000.",
      default: "1000",
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

    return runTool(client, "outlit_query", { sql, limit: Number(args.limit) }, json)
  },
})
