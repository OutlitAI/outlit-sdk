import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { normalizeProviderInput, PROVIDER_NAMES } from "../../lib/providers"

export default defineCommand({
  meta: {
    name: "capabilities",
    description: [
      "Show machine-readable integration setup capabilities.",
      "",
      "Use this before setup so agents know whether a provider uses browser auth,",
      "direct credential config, or has required follow-up steps such as CRM mappings.",
      "",
      "Examples:",
      "  outlit integrations capabilities --json",
      "  outlit integrations capabilities hubspot --json",
      "",
      `Providers: ${PROVIDER_NAMES.join(", ")}`,
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
        "outlit_integration_capabilities",
        { provider: normalizeProviderInput(args.provider) },
        json,
        {
          spinnerMessage: "Fetching integration capabilities...",
        },
      )
    }

    return runTool(client, "outlit_integration_capabilities", {}, json, {
      spinnerMessage: "Fetching integration capabilities...",
    })
  },
})
