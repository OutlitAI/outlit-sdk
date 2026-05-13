import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { capitalize, formatNumber, relativeDate, truncate } from "../../lib/format"
import { outputError } from "../../lib/output"
import { resolveProviderOrExit } from "../../lib/providers"

function hideBlankModelSyncs(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data
  }

  const record = data as Record<string, unknown>
  if (!Array.isArray(record.syncs)) {
    return data
  }

  return {
    ...record,
    syncs: record.syncs.filter((sync) => {
      if (typeof sync !== "object" || sync === null || Array.isArray(sync)) {
        return false
      }

      const model = (sync as Record<string, unknown>).model
      return typeof model === "string" && model.trim().length > 0
    }),
  }
}

export default defineCommand({
  meta: {
    name: "status",
    description: [
      "Show sync status for connected integrations.",
      "",
      "Without a provider name, shows a summary of all connected integrations.",
      "With a provider name, shows detailed per-model sync status.",
      "With --session, checks a browser/Nango setup session returned by `integrations setup`.",
      "",
      "Examples:",
      "  outlit integrations status              # summary of all",
      "  outlit integrations status stripe       # detailed Stripe sync status",
      "  outlit integrations status --session sess_123 --json",
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
    session: {
      type: "string",
      description:
        "Browser/Nango setup session ID returned by `outlit integrations setup <provider>`.",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    if (args.session && args.provider) {
      return outputError(
        { message: "Use either a provider name or --session, not both.", code: "invalid_input" },
        json,
      )
    }

    if (args.session) {
      return runTool(client, "outlit_connect_status", { sessionId: args.session }, json, {
        spinnerMessage: "Checking setup session...",
      })
    }

    if (args.provider) {
      const { provider } = resolveProviderOrExit(args.provider, json)
      return runTool(client, "outlit_integration_sync_status", { provider: provider.id }, json, {
        spinnerMessage: "Fetching sync status...",
        transform: hideBlankModelSyncs,
        table: {
          columns: [
            { header: "Model", key: "model" },
            { header: "Status", key: "status" },
            { header: "Records", key: "recordCount", format: formatNumber },
            { header: "Last Synced", key: "lastSyncedAt", format: relativeDate },
          ],
          itemsKey: "syncs",
        },
      })
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
