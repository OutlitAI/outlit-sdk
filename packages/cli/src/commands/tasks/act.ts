import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { newIdempotencyKey } from "../../lib/idempotency-key"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, requiredTrimmedString } from "../../lib/platform-input"

const properties = publicToolContracts.outlit_act_on_task.inputSchema.properties
const actions = properties.action.enum
const reasons = properties.reason.enum

export default defineCommand({
  meta: {
    name: "act",
    description: [
      publicToolContracts.outlit_act_on_task.description,
      "",
      `Actions: ${actions.join(", ")}`,
      `Reasons (wont_do only): ${reasons.join(", ")}`,
      "",
      "Examples:",
      "  outlit tasks act <id> done",
      "  outlit tasks act <id> snooze --until 2026-11-14T09:00:00Z",
      "  outlit tasks act <id> wont_do --reason not_needed --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Task ID, from `outlit tasks list`", required: true },
    action: {
      type: "positional",
      description: `Action the task accepts (${actions.join(", ")})`,
      required: true,
    },
    until: {
      type: "string",
      description: "snooze only: ISO 8601 date-time within 14 days (default: a week)",
    },
    reason: { type: "string", description: `wont_do only (${reasons.join(", ")})` },
    "idempotency-key": {
      type: "string",
      description: "Stable retry key: the same id returns the first result (default: a new one)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const id = requiredTrimmedString(args.id, "<id>", json)
    const action = requiredTrimmedString(args.action, "<action>", json).toLowerCase()
    if (!(actions as readonly string[]).includes(action)) {
      return outputError(
        { message: `<action> must be one of: ${actions.join(", ")}`, code: "invalid_input" },
        json,
      )
    }
    const input: Record<string, unknown> = { id, action }
    const until = optionalTrimmedString(args.until)
    if (until) input.until = until
    const reason = optionalTrimmedString(args.reason)?.toLowerCase()
    if (reason) {
      if (!(reasons as readonly string[]).includes(reason)) {
        return outputError(
          { message: `--reason must be one of: ${reasons.join(", ")}`, code: "invalid_input" },
          json,
        )
      }
      input.reason = reason
    }
    input.idempotencyKey = optionalTrimmedString(args["idempotency-key"]) ?? newIdempotencyKey()

    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_act_on_task.toolName, input, json, {
      spinnerMessage: "Updating task...",
    })
  },
})
