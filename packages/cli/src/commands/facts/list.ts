import {
  customerFactCategories,
  customerFactStatuses,
  customerFactTypes,
  customerSourceTypes,
  customerToolContracts,
  unsupportedCustomerFactTypes,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
import { outputError } from "../../lib/output"

function parseCsvArg(value?: string): string[] | undefined {
  if (!value) return undefined

  const items = splitCsv(value)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function invalidValues(values: string[] | undefined, allowed: readonly string[]): string[] {
  if (!values) return []
  return values.filter((value) => !allowed.includes(value))
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List structured facts for a customer.",
      "",
      "Filter by fact status, source type, or occurrence date range.",
      "",
      "Examples:",
      "  outlit facts list acme.com",
      "  outlit facts list acme.com --status ACTIVE",
      "  outlit facts list acme.com --fact-types CHURN_RISK,EXPANSION --fact-categories MEMORY",
      "  outlit facts list acme.com --source-types CALL,EMAIL --after 2025-01-01T00:00:00Z",
      "  outlit facts list acme.com --limit 50 --json",
      "",
      `Statuses: ${customerFactStatuses.join(", ")}`,
      `Source types: ${customerSourceTypes.join(", ")}`,
      `Fact categories: ${customerFactCategories.join(", ")}`,
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
      description: "Customer UUID or domain to retrieve facts for",
      required: true,
    },
    status: {
      type: "string",
      description: `Comma-separated fact statuses (${customerFactStatuses.join(", ")})`,
    },
    "source-types": {
      type: "string",
      description: `Comma-separated generic source type filter (${customerSourceTypes.join(", ")})`,
    },
    "fact-types": {
      type: "string",
      description:
        "Comma-separated customer-memory fact type filter, such as CHURN_RISK, EXPANSION, or SENTIMENT",
    },
    "fact-categories": {
      type: "string",
      description: `Comma-separated fact category filter (${customerFactCategories.join(", ")})`,
    },
    after: {
      type: "string",
      description: "Filter to facts occurring after this ISO 8601 datetime",
    },
    before: {
      type: "string",
      description: "Filter to facts occurring before this ISO 8601 datetime",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const statuses = parseCsvArg(args.status)
    const sourceTypes = parseCsvArg(args["source-types"])
    const factTypes = parseCsvArg(args["fact-types"])
    const factCategories = parseCsvArg(args["fact-categories"])

    const invalidStatuses = invalidValues(statuses, customerFactStatuses)
    if (invalidStatuses.length > 0) {
      return outputError(
        {
          message: `Unknown fact statuses: ${invalidStatuses.join(", ")}. Allowed: ${customerFactStatuses.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const invalidSourceTypes = invalidValues(sourceTypes, customerSourceTypes)
    if (invalidSourceTypes.length > 0) {
      return outputError(
        {
          message: `Unknown source types: ${invalidSourceTypes.join(", ")}. Allowed: ${customerSourceTypes.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const invalidFactTypes = invalidValues(factTypes, customerFactTypes)
    if (invalidFactTypes.length > 0) {
      const anomalyFactTypes = invalidFactTypes.filter((value) =>
        unsupportedCustomerFactTypes.includes(
          value as (typeof unsupportedCustomerFactTypes)[number],
        ),
      )
      const unknownFactTypes = invalidFactTypes.filter(
        (value) =>
          !unsupportedCustomerFactTypes.includes(
            value as (typeof unsupportedCustomerFactTypes)[number],
          ),
      )
      const messageParts: string[] = []

      if (anomalyFactTypes.length > 0) {
        messageParts.push(
          `Anomaly detector fact types are not supported as public filters: ${anomalyFactTypes.join(", ")}. Use customer-memory fact types such as CHURN_RISK, EXPANSION, SENTIMENT, or PRODUCT_USAGE.`,
        )
      }

      if (unknownFactTypes.length > 0) {
        messageParts.push(
          `Unknown fact types: ${unknownFactTypes.join(", ")}. Allowed: ${customerFactTypes.join(", ")}`,
        )
      }

      return outputError(
        {
          message: messageParts.join(" "),
          code: "invalid_input",
        },
        json,
      )
    }

    const invalidFactCategories = invalidValues(factCategories, customerFactCategories)
    if (invalidFactCategories.length > 0) {
      return outputError(
        {
          message: `Unsupported fact categories: ${invalidFactCategories.join(", ")}. Allowed: ${customerFactCategories.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const afterDate = args.after ? new Date(args.after) : null
    const beforeDate = args.before ? new Date(args.before) : null

    if (afterDate && Number.isNaN(afterDate.getTime())) {
      return outputError(
        {
          message: "--after must be a valid ISO 8601 datetime",
          code: "invalid_input",
        },
        json,
      )
    }

    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
      return outputError(
        {
          message: "--before must be a valid ISO 8601 datetime",
          code: "invalid_input",
        },
        json,
      )
    }

    if (afterDate && beforeDate && afterDate.getTime() > beforeDate.getTime()) {
      return outputError(
        {
          message: "--after must be before or equal to --before",
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {
      customer: args.customer,
    }
    if (statuses) params.status = statuses
    if (sourceTypes) params.sourceTypes = sourceTypes
    if (factTypes) params.factTypes = factTypes
    if (factCategories) params.factCategories = factCategories
    if (args.after) params.after = args.after
    if (args.before) params.before = args.before
    applyPagination(params, args, json)

    return runTool(client, customerToolContracts.outlit_list_facts.toolName, params, json)
  },
})
