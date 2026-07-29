import {
  customerSourceTypeAliases,
  customerSourceTypeInputs,
  customerSourceTypes,
  customerToolContracts,
  normalizeCustomerSourceType,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

const sourceTypeDescription = `${customerSourceTypes.join(", ")} (aliases: ${customerSourceTypeAliases.join(", ")})`
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
      "Use this when you need enumerated calls, emails, calendar events, support tickets, or opportunities rather than semantic ranking.",
      "",
      "Examples:",
      "  outlit sources list --customer acme.com --source-type CALL",
      "  outlit sources list --participant alice@acme.com --source-type CALENDAR_EVENT --json",
      "  outlit sources list --after 2026-01-01T00:00:00Z --limit 25",
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
      description: `Source type (${sourceTypeDescription})`,
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
      description: "Results per page (1-100). Default: 50.",
    },
    cursor: {
      type: "string",
      description: "Pagination cursor from a previous response (pagination.nextCursor)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const sourceType = args["source-type"]
      ? normalizeCustomerSourceType(args["source-type"])
      : undefined

    if (args["source-type"] && !sourceType) {
      return outputError(
        {
          message: `--source-type must be one of ${customerSourceTypeInputs.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    if (args["has-transcript"] && sourceType && sourceType !== "CALL") {
      return outputError(
        {
          message: "--has-transcript can only be used with CALL sources",
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
    if (sourceType) params.sourceType = sourceType
    if (args.customer) params.customer = args.customer
    if (args.participant) params.participant = args.participant
    if (args.provider) params.provider = args.provider
    if (args["has-transcript"]) params.hasTranscript = true
    if (args.after) params.after = args.after
    if (args.before) params.before = args.before
    if (limit) params.limit = limit
    if (args.cursor) params.cursor = args.cursor

    return runTool(client, customerToolContracts.outlit_list_sources.toolName, params, json, {
      table: {
        columns: [
          { header: "TYPE", key: "sourceType" },
          { header: "OCCURRED", key: "occurredAt" },
          { header: "TITLE", key: "title" },
          { header: "SOURCE ID", key: "sourceId" },
        ],
      },
    })
  },
})
