import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

/** Prints the one destination that was asked for; an id Core does not show is reported as missing. */
function oneDestination(data: unknown, json: boolean): unknown {
  const { items, missing } = data as { items?: unknown[]; missing?: string[] }
  const [destination] = items ?? []
  if (destination) return { destination }
  return outputError(
    {
      message: `Destination not found: ${missing?.[0] ?? "unknown id"}`,
      code: "not_found",
    },
    json,
  )
}

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one configured Outlit automation destination by id with masked configuration only.",
      "",
      "Examples:",
      "  outlit destinations get 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: {
      type: "positional",
      description: "Destination ID to fetch",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_list_destinations", { ids: [args.id] }, json, {
      spinnerMessage: "Fetching destination...",
      transform: (data) => oneDestination(data, json),
    })
  },
})
