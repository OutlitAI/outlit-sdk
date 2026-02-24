import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"

export default defineCommand({
  meta: {
    name: "timeline",
    description: [
      "Show the activity timeline for a customer.",
      "",
      "The customer argument accepts:",
      "  - Customer domain (acme.com)",
      "  - Customer ID (UUID)",
      "",
      "Timeframe is used when no explicit date range is set.",
      "When --start-date or --end-date is provided, --timeframe is ignored.",
      "",
      "Examples:",
      "  outlit customers timeline acme.com",
      "  outlit customers timeline acme.com --timeframe 90d",
      "  outlit customers timeline acme.com --channels EMAIL,SLACK",
      "  outlit customers timeline acme.com --start-date 2025-01-01 --end-date 2025-03-01",
      "  outlit customers timeline acme.com --event-types PAGE_VIEW,MEETING --limit 50",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...paginationArgs,
    customer: {
      type: "positional",
      description: "Customer ID or domain (acme.com)",
      required: true,
    },
    channels: {
      type: "string",
      description: "Comma-separated list of channels to filter (e.g. EMAIL,SLACK)",
    },
    "event-types": {
      type: "string",
      description: "Comma-separated list of event types to filter (e.g. PAGE_VIEW,MEETING)",
    },
    timeframe: {
      type: "string",
      description:
        "Timeframe for events (e.g. 7d, 14d, 30d, 90d). Ignored when --start-date or --end-date is set.",
      default: "30d",
    },
    "start-date": {
      type: "string",
      description:
        "Start date for the event range (ISO 8601, e.g. 2025-01-01). When set, --timeframe is ignored.",
    },
    "end-date": {
      type: "string",
      description:
        "End date for the event range (ISO 8601, e.g. 2025-03-01). When set, --timeframe is ignored.",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const hasDateRange = !!args["start-date"] || !!args["end-date"]

    const params: Record<string, unknown> = { customer: args.customer }

    // MUTUAL EXCLUSIVITY: send timeframe only when no date range is set
    if (hasDateRange) {
      if (args["start-date"]) params.startDate = args["start-date"]
      if (args["end-date"]) params.endDate = args["end-date"]
    } else {
      params.timeframe = args.timeframe
    }

    if (args.channels) {
      params.channels = splitCsv(args.channels)
    }
    if (args["event-types"]) {
      params.eventTypes = splitCsv(args["event-types"])
    }
    applyPagination(params, args)

    return runTool(client, "outlit_get_timeline", params, json)
  },
})
