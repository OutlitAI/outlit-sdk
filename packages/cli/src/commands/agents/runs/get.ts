import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one agent run by database id or public run id.",
      "",
      "Examples:",
      "  outlit agents runs get 10000000-0000-4000-8000-000000000004 run_123 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    agentId: {
      type: "positional",
      description: "Agent ID",
      required: true,
    },
    runId: {
      type: "positional",
      description: "Agent run ID or public run ID",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_agent_run_get",
      { agentId: args.agentId, runId: args.runId },
      json,
      {
        spinnerMessage: "Fetching agent run...",
      },
    )
  },
})
