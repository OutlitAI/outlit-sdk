import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"
import { optionalTrimmedString } from "../../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "start",
    description: [
      "Start a manual run for one configured legacy Outlit churn agent.",
      "Template and custom agents run through automations.",
      "",
      "Examples:",
      "  outlit agents runs start 10000000-0000-4000-8000-000000000004 --json",
      "  outlit agents runs start 10000000-0000-4000-8000-000000000004 --client-request-id smoke-123 --json",
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
    "client-request-id": {
      type: "string",
      description: "Optional idempotency key for retrying the same manual run request",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const clientRequestId = optionalTrimmedString(args["client-request-id"])

    return runTool(
      client,
      "outlit_agent_run_start",
      {
        agentId: args.agentId,
        ...(clientRequestId ? { clientRequestId } : {}),
      },
      json,
      {
        spinnerMessage: "Starting agent run...",
      },
    )
  },
})
