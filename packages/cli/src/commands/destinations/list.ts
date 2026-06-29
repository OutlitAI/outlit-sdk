import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { relativeDate, truncate } from "../../lib/format"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stripRawDestinationConfig(data: unknown): unknown {
  if (!isRecord(data) || !isRecord(data.result) || !isRecord(data.result.data)) {
    return data
  }

  const destinations = data.result.data.destinations
  if (!Array.isArray(destinations)) {
    return data
  }

  return {
    ...data,
    result: {
      ...data.result,
      data: {
        ...data.result.data,
        destinations: destinations.map((destination) => {
          if (!isRecord(destination)) {
            return destination
          }

          const safeDestination = { ...destination }
          delete safeDestination.configJson
          return safeDestination
        }),
      },
    },
  }
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Outlit automation destinations with masked configuration only.",
      "",
      "Examples:",
      "  outlit destinations list",
      "  outlit destinations list --json",
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

    return runTool(client, "outlit_destination_list", {}, json, {
      spinnerMessage: "Fetching destinations...",
      transform: stripRawDestinationConfig,
      table: {
        itemsKey: "result.data.destinations",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Name", key: "name", format: (v) => truncate(v, 32) },
          { header: "Provider", key: "provider" },
          { header: "Kind", key: "kind", format: (v) => truncate(v, 22) },
          { header: "Enabled", key: "enabled", format: (v) => (v === true ? "yes" : "no") },
          { header: "Sync", key: "syncStatus", format: (v) => truncate(v, 22) },
          { header: "Updated", key: "updatedAt", format: relativeDate },
        ],
      },
    })
  },
})
