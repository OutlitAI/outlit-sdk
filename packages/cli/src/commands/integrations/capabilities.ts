import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { normalizeProviderInput } from "../../lib/providers"

export default defineCommand({
  meta: {
    name: "capabilities",
    description: [
      "Show machine-readable integration setup capabilities.",
      "",
      "Use this before setup to learn whether a safe browser handoff is available",
      "or configuration must continue in the Outlit web app.",
      "",
      "Examples:",
      "  outlit integrations capabilities --json",
      "  outlit integrations capabilities hubspot --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    provider: {
      type: "positional",
      description: "Provider name to inspect (optional)",
      required: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    if (args.provider) {
      return runTool(
        client,
        "outlit_get_integration_capabilities",
        { provider: normalizeProviderInput(args.provider) },
        json,
        {
          spinnerMessage: "Fetching integration capabilities...",
        },
      )
    }

    return runTool(client, "outlit_get_integration_capabilities", {}, json, {
      spinnerMessage: "Fetching integration capabilities...",
    })
  },
})
