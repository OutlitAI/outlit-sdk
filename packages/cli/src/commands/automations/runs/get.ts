import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one automation run by id.",
      "",
      "Examples:",
      "  outlit automations runs get 10000000-0000-4000-8000-000000000001 10000000-0000-4000-8000-000000000006 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    automationId: {
      type: "positional",
      description: "Automation ID",
      required: true,
    },
    runId: {
      type: "positional",
      description: "Automation run ID",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_automation_run_get",
      { automationId: args.automationId, runId: args.runId },
      json,
      {
        spinnerMessage: "Fetching automation run...",
      },
    )
  },
})
