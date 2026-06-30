import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { parseIntegerFlag } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "options",
    description: [
      "Show destination schemas and Slack channel options.",
      "",
      "Examples:",
      "  outlit destinations options --json",
      "  outlit destinations options --search ops --limit 20 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    search: {
      type: "string",
      description: "Search Slack channels by name or ID",
    },
    limit: {
      type: "string",
      description: "Max Slack channels to return (1-100). Default: 50.",
      default: "50",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const limit = parseIntegerFlag(args.limit, 50, "--limit", json)
    if (limit < 1 || limit > 100) {
      return outputError(
        { message: "--limit must be an integer between 1 and 100", code: "invalid_input" },
        json,
      )
    }

    return runTool(
      client,
      "outlit_destination_options",
      {
        search: args.search,
        limit,
      },
      json,
      {
        spinnerMessage: "Fetching destination options...",
      },
    )
  },
})
