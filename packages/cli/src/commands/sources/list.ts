import { publicToolContracts, sourceTypes as toolSourceTypes } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { PAGE_SIZE } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
import { outputError } from "../../lib/output"
import { toWireSourceTypes } from "../../lib/source-types"

const sourceTypeDescription = toolSourceTypes.join(", ")
const ISO_8601_UTC_DATE_TIME_REGEX =
  /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$/

function parseLimit(value: string | undefined, json: boolean): number | undefined {
  if (!value) return undefined

  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    outputError(
      {
        message: `--limit must be an integer between 1 and 100 (got: ${value})`,
        code: "invalid_input",
      },
      json,
    )
    return undefined
  }

  return limit
}

function parseDateArg(name: "--after" | "--before", value: string | undefined, json: boolean) {
  if (!value) return null

  if (!ISO_8601_UTC_DATE_TIME_REGEX.test(value)) {
    outputError(
      {
        message: `${name} must be a valid ISO 8601 UTC datetime`,
        code: "invalid_input",
      },
      json,
    )
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    outputError(
      {
        message: `${name} must be a valid ISO 8601 datetime`,
        code: "invalid_input",
      },
      json,
    )
    return null
  }

  return date
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List concrete source records deterministically.",
      "",
      "Use this when you need enumerated calls, emails, calendar events, support tickets, opportunities, or Slack conversations rather than semantic ranking.",
      "",
      "Examples:",
      "  outlit sources list --customer acme.com --source-type call",
      "  outlit sources list --participant alice@acme.com --source-type calendar_event --json",
      "  outlit sources list --source-type call,email --after 2026-01-01T00:00:00Z --limit 25",
      "",
      `Source types: ${sourceTypeDescription}`,
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "source-type": {
      type: "string",
      description: `Source type, or several separated by commas (${sourceTypeDescription})`,
    },
    customer: {
      type: "string",
      description: "Customer UUID, domain, or name to scope source listing",
    },
    participant: {
      type: "string",
      description: "Participant email or name to filter source records",
    },
    provider: {
      type: "string",
      description: "Provider identifier such as gmail, gong, or google-calendar",
    },
    "has-transcript": {
      type: "boolean",
      description: "Only list call sources with a finalized transcript",
    },
    after: {
      type: "string",
      description: "Filter to sources occurring after this ISO 8601 datetime",
    },
    before: {
      type: "string",
      description: "Filter to sources occurring before this ISO 8601 datetime",
    },
    limit: {
      type: "string",
      description: `Results per page (1-${PAGE_SIZE.max}). Default: ${PAGE_SIZE.default}.`,
    },
    cursor: {
      type: "string",
      description: "Pagination cursor from a previous response (page.nextCursor)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    // Any case is accepted, and the previously published aliases (CRM, STRIPE_INVOICE).
    const requestedTypes = args["source-type"]
      ? splitCsv(args["source-type"])
          .map((item) => item.trim())
          .filter(Boolean)
      : []
    const sourceTypeResult = toWireSourceTypes(requestedTypes, { sourceTools: true })
    if (!sourceTypeResult.ok || (args["source-type"] && requestedTypes.length === 0)) {
      return outputError(
        {
          message: `--source-type must be one of ${sourceTypeDescription}`,
          code: "invalid_input",
        },
        json,
      )
    }
    const sourceTypes = sourceTypeResult.types

    if (args["has-transcript"] && sourceTypes.length > 0 && !sourceTypes.includes("call")) {
      return outputError(
        {
          message: "--has-transcript can only be used with call sources",
          code: "invalid_input",
        },
        json,
      )
    }

    const afterDate = parseDateArg("--after", args.after, json)
    if (args.after && !afterDate) return

    const beforeDate = parseDateArg("--before", args.before, json)
    if (args.before && !beforeDate) return

    if (afterDate && beforeDate && afterDate.getTime() > beforeDate.getTime()) {
      return outputError(
        {
          message: "--after must be before or equal to --before",
          code: "invalid_input",
        },
        json,
      )
    }

    const limit = parseLimit(args.limit, json)
    if (args.limit && !limit) return

    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = {}
    if (args.customer) params.customer = args.customer
    // v2 puts every filter under `filters`; source types are any-of.
    const filters: Record<string, unknown> = {}
    if (sourceTypes.length > 0) filters.sourceTypes = sourceTypes
    if (args.participant) filters.participant = args.participant
    if (args.provider) filters.provider = args.provider
    if (args["has-transcript"]) filters.hasTranscript = true
    if (args.after) filters.after = args.after
    if (args.before) filters.before = args.before
    if (Object.keys(filters).length > 0) params.filters = filters
    if (limit) params.limit = limit
    if (args.cursor) params.cursor = args.cursor

    return runTool(client, publicToolContracts.outlit_list_sources.toolName, params, json, {
      table: {
        columns: [
          { header: "TYPE", key: "source.type" },
          { header: "OCCURRED", key: "occurredAt" },
          { header: "TITLE", key: "title" },
          { header: "SOURCE ID", key: "source.id" },
        ],
      },
    })
  },
})
