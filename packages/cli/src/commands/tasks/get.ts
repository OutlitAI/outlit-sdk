import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { parseCsvList, requiredTrimmedString } from "../../lib/platform-input"

const includes = publicToolContracts.outlit_get_task.inputSchema.properties.include.items.enum

export default defineCommand({
  meta: {
    name: "get",
    description: [
      publicToolContracts.outlit_get_task.description,
      "",
      "Examples:",
      "  outlit tasks get <id>",
      "  outlit tasks get <id> --include source,draft --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Task ID, from `outlit tasks list`", required: true },
    include: {
      type: "string",
      description: `Comma-separated extras (${includes.join(", ")}). Default: source,covered`,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const id = requiredTrimmedString(args.id, "<id>", json)
    const include = parseCsvList(args.include).map((value) => value.toLowerCase())
    const unknown = include.filter((value) => !(includes as readonly string[]).includes(value))
    if (unknown.length > 0) {
      return outputError(
        {
          message: `Unknown include values: ${unknown.join(", ")}. Allowed: ${includes.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      publicToolContracts.outlit_get_task.toolName,
      { id, ...(include.length > 0 ? { include } : {}) },
      json,
      { spinnerMessage: "Loading task..." },
    )
  },
})
