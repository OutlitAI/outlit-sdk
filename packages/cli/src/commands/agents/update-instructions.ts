import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "update-instructions",
    description: ["Update a custom hosted Outlit agent's instructions.", "", AGENT_JSON_HINT].join(
      "\n",
    ),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Agent ID", required: true },
    instructions: { type: "string", description: "Agent instructions" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_agent_update_instructions",
      {
        id: args.id,
        instructions: requiredTrimmedString(args.instructions, "--instructions", json),
      },
      json,
      { spinnerMessage: "Updating agent instructions..." },
    )
  },
})
