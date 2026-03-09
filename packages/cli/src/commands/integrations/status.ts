import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { capitalize, formatNumber, relativeDate, truncate } from "../../lib/format"
import { outputError } from "../../lib/output"
import { resolveProvider } from "../../lib/providers"

export default defineCommand({
  meta: {
    name: "status",
    description: [
      "Show sync status for connected integrations.",
      "",
      "Without a provider name, shows a summary of all connected integrations.",
      "With a provider name, shows detailed per-model sync status.",
      "",
      "Examples:",
      "  outlit integrations status              # summary of all",
      "  outlit integrations status salesforce    # detailed Salesforce sync status",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    provider: {
      type: "positional",
      description: "Provider name to show detailed status for (optional)",
      required: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    if (args.provider) {
      const result = resolveProvider(args.provider)
      if ("error" in result) {
        return outputError({ message: result.error, code: "unknown_provider" }, json)
      }
      return runTool(
        client,
        "outlit_integration_sync_status",
        { provider: result.provider.id },
        json,
        {
          spinnerMessage: "Fetching sync status...",
          table: {
            columns: [
              { header: "Model", key: "model" },
              { header: "Status", key: "status" },
              { header: "Records", key: "recordCount", format: formatNumber },
              { header: "Last Synced", key: "lastSyncedAt", format: relativeDate },
            ],
            itemsKey: "syncs",
          },
        },
      )
    }

    return runTool(client, "outlit_list_integrations", { connectedOnly: true }, json, {
      spinnerMessage: "Fetching integration status...",
      table: {
        columns: [
          { header: "Name", key: "name", format: (v) => truncate(v, 24) },
          { header: "Category", key: "category", format: capitalize },
          { header: "Sync Status", key: "syncStatus" },
          { header: "Last Synced", key: "lastDataReceivedAt", format: relativeDate },
        ],
      },
    })
  },
})
