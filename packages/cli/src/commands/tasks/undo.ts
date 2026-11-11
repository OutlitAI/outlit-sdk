import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { newIdempotencyKey } from "../../lib/idempotency-key"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "undo",
    description: [
      publicToolContracts.outlit_undo_task_action.description,
      "",
      "Example:",
      "  outlit tasks undo <undo.token> --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "undo-token": {
      type: "positional",
      description: "undo.token from `outlit tasks act`, as it came",
      required: true,
    },
    "idempotency-key": {
      type: "string",
      description: "Stable retry key: the same id returns the first result (default: a new one)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const undoToken = requiredTrimmedString(args["undo-token"], "<undo-token>", json)
    const idempotencyKey = optionalTrimmedString(args["idempotency-key"]) ?? newIdempotencyKey()
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_undo_task_action.toolName,
      { undoToken, idempotencyKey },
      json,
      { spinnerMessage: "Undoing task action..." },
    )
  },
})
