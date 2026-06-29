import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "rename",
    description: [
      "Rename a configured Outlit agent display name.",
      "",
      "Examples:",
      "  outlit agents rename 10000000-0000-4000-8000-000000000004 'Churn prevention' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Agent ID to rename",
      required: true,
    },
    displayName: {
      type: "positional",
      description: "New display name",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_agent_rename",
      { id: args.id, displayName: args.displayName },
      json,
      {
        spinnerMessage: "Renaming agent...",
      },
    )
  },
})
