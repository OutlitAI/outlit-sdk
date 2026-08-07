import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { capitalize, relativeDate, truncate } from "../../lib/format"
import { normalizeProviderInput } from "../../lib/providers"

export default defineCommand({
  meta: {
    name: "status",
    description: [
      "Show canonical integration readiness for agents and operators.",
      "",
      "Without a provider name, shows the status of every available integration.",
      "With a provider name, returns its single canonical readiness status.",
      "Browser-auth session and raw provider-state details stay internal to Outlit.",
      "",
      "Examples:",
      "  outlit integrations status",
      "  outlit integrations status stripe --json",
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
    const provider = args.provider ? normalizeProviderInput(args.provider) : undefined

    return runTool(client, "outlit_get_integration_status", provider ? { provider } : {}, json, {
      spinnerMessage: "Fetching integration status...",
      table: {
        itemsKey: "integrations",
        columns: [
          { header: "Name", key: "name", format: (value) => truncate(value, 24) },
          { header: "Category", key: "category", format: capitalize },
          { header: "Status", key: "status" },
          { header: "First Data", key: "lastDataReceivedAt", format: relativeDate },
        ],
      },
    })
  },
})
