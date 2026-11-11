import { publicToolContracts, timelineTimeframes, toolTimelineChannels } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, pageSizeArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"

/** Previously published channel names, accepted and mapped to the current ones. */
const legacyTimelineChannelMap = {
  sdk: "product",
  email: "communication",
  slack: "communication",
  call: "meeting",
  calendar: "meeting",
  internal: "system",
} as const

/** Channels are lowercase on the wire; any case is accepted, and so are the old channel names. */
function normalizeTimelineChannels(value: string): string[] {
  return [
    ...new Set(
      splitCsv(value)
        .filter((channel) => channel.length > 0)
        .map((channel) => {
          const normalized = channel.toLowerCase()
          return (
            legacyTimelineChannelMap[normalized as keyof typeof legacyTimelineChannelMap] ??
            normalized
          )
        }),
    ),
  ]
}

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Show the activity timeline for a customer.",
      "",
      "The customer argument accepts:",
      "  - Customer domain (acme.com)",
      "  - Customer ID (UUID)",
      "",
      "--timeframe counts back from now, or from --end-date when that is set.",
      "When --start-date is provided, --timeframe is ignored.",
      `Channels: ${toolTimelineChannels.join(", ")}`,
      `Timeframes: ${timelineTimeframes.join(", ")}`,
      "",
      "Examples:",
      "  outlit timeline get acme.com",
      "  outlit timeline get acme.com --timeframe 90d",
      "  outlit timeline get acme.com --channels communication,meeting",
      "  outlit timeline get acme.com --start-date 2025-01-01T00:00:00Z --end-date 2025-03-01T23:59:59.999Z",
      "  outlit timeline get acme.com --event-types note_added,email_received --limit 50",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...pageSizeArgs,
    customer: {
      type: "positional",
      description: "Customer ID or domain (acme.com)",
      required: true,
    },
    channels: {
      type: "string",
      description: `Comma-separated list of channels to filter (${toolTimelineChannels.join(", ")})`,
    },
    "event-types": {
      type: "string",
      description: "Comma-separated list of event types to filter (e.g. note_added,email_received)",
    },
    timeframe: {
      type: "string",
      description: `Timeframe for events (${timelineTimeframes.join(", ")}). Ignored when --start-date is set.`,
      default: "30d",
    },
    "start-date": {
      type: "string",
      description:
        "Start datetime for the event range (ISO 8601, e.g. 2025-01-01T00:00:00Z). When set, --timeframe is ignored.",
    },
    "end-date": {
      type: "string",
      description:
        "End datetime for the event range (ISO 8601, e.g. 2025-03-01T23:59:59.999Z). --timeframe counts back from it.",
    },
    "product-detail": {
      type: "string",
      description: "How much product activity to include (none, material, raw)",
    },
    "include-metadata": {
      type: "boolean",
      description: "Add each event's metadata",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = { customer: args.customer }

    // v2 puts the window under filters: `after` is an explicit start, otherwise `within` counts
    // back from `before` (or from now). `--timeframe` and `--end-date` therefore work together.
    const filters: Record<string, unknown> = {}
    if (args["start-date"]) filters.after = args["start-date"]
    else filters.within = args.timeframe.toLowerCase()
    if (args["end-date"]) filters.before = args["end-date"]
    if (args.channels) filters.channels = normalizeTimelineChannels(args.channels)
    if (args["event-types"]) {
      filters.eventTypes = splitCsv(args["event-types"]).map((type) => type.toLowerCase())
    }
    params.filters = filters
    const productDetail = args["product-detail"]?.trim().toLowerCase()
    if (productDetail) params.productDetail = productDetail
    if (args["include-metadata"] === true) params.includeMetadata = true
    applyPagination(params, args, json)

    return runTool(client, publicToolContracts.outlit_get_timeline.toolName, params, json)
  },
})
