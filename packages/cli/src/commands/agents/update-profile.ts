import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "update-profile",
    description: ["Update an Outlit agent profile.", "", AGENT_JSON_HINT].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Agent ID", required: true },
    "display-name": { type: "string", description: "Agent display name" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_agent_update_profile",
      {
        id: args.id,
        displayName: requiredTrimmedString(args["display-name"], "--display-name", json),
      },
      json,
      { spinnerMessage: "Updating agent profile..." },
    )
  },
})
