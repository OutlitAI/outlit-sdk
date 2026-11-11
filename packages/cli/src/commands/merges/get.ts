import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      publicToolContracts.outlit_get_merge.description,
      "",
      "Usage: outlit merges get <id> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Admitted merge operation ID", required: true },
  },
  async run({ args }) {
    const json = !!args.json
    const operationId = requiredTrimmedString(args.id, "<id>", json)
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_get_merge.toolName, { id: operationId }, json)
  },
})
