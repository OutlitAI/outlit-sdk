import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { activationToolNames } from "../../lib/activation"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Read the configured Core-derived company activation definition.",
      "",
      "The response also explains compatibility with the legacy contact activation event.",
      "",
      "Examples:",
      "  outlit activation get --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, activationToolNames.get, {}, json, {
      spinnerMessage: "Fetching company activation...",
    })
  },
})
