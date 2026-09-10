import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "merge-status",
    description: [
      publicToolContracts.outlit_get_customer_merge_status.description,
      "",
      "Usage: outlit customers merge-status <operationId> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    operationId: { type: "positional", description: "Admitted merge operation ID", required: true },
  },
  async run({ args }) {
    const json = !!args.json
    const operationId = requiredTrimmedString(args.operationId, "<operationId>", json)
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_get_customer_merge_status.toolName,
      { operationId },
      json,
    )
  },
})
