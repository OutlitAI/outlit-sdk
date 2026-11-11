import {
  publicToolContracts,
  toolFactCategories,
  toolFactStatuses,
  toolFactTypes,
  sourceTypes as toolSourceTypes,
  unsupportedCustomerFactTypes,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { factIncludeArg, readFactIncludes } from "../../args/fact-include"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, pageSizeArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
import { outputError } from "../../lib/output"
import { toWireSourceTypes } from "../../lib/source-types"

function parseCsvArg(value?: string): string[] | undefined {
  if (!value) return undefined

  const items = splitCsv(value)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function invalidValues(values: string[] | undefined, allowed: readonly string[]): string[] {
  if (!values) return []
  return values.filter((value) => !allowed.includes(value))
}

const sourceTypeDescription = toolSourceTypes.join(", ")
const unsupportedFactTypes: readonly string[] = unsupportedCustomerFactTypes.map((value) =>
  value.toLowerCase(),
)

function isOneOf(values: readonly string[], value: unknown): value is string {
  return typeof value === "string" && values.includes(value)
}

function annotateFactFilterability(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data
  }

  const record = data as Record<string, unknown>
  if (!Array.isArray(record.facts)) {
    return data
  }

  return {
    ...record,
    facts: record.facts.map((fact) => {
      if (typeof fact !== "object" || fact === null || Array.isArray(fact)) {
        return fact
      }

      const factRecord = fact as Record<string, unknown>
      return {
        ...factRecord,
        filterability: {
          type: isOneOf(toolFactTypes, factRecord.type) ? "public" : "internal",
          category: isOneOf(toolFactCategories, factRecord.category) ? "public" : "internal",
        },
      }
    }),
  }
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List structured facts for a customer.",
      "",
      "Filter by fact status, type, category, source type, or occurrence date range.",
      "A fact has no reasoning or source quote unless --include asks for it (reasoning, quote, evidence).",
      "",
      "Examples:",
      "  outlit facts list acme.com",
      "  outlit facts list acme.com --status active",
      "  outlit facts list acme.com --fact-types churn_risk,expansion",
      "  outlit facts list acme.com --source-types call,opportunity --after 2025-01-01T00:00:00Z",
      "  outlit facts list acme.com --include reasoning,quote",
      "  outlit facts list acme.com --limit 50 --json",
      "",
      `Statuses: ${toolFactStatuses.join(", ")}`,
      `Source types: ${sourceTypeDescription}`,
      `Fact categories: ${toolFactCategories.join(", ")}`,
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
      description: "Customer UUID or domain to retrieve facts for",
      required: true,
    },
    status: {
      type: "string",
      description: `Comma-separated fact statuses (${toolFactStatuses.join(", ")})`,
    },
    "source-types": {
      type: "string",
      description: `Comma-separated generic source type filter (${sourceTypeDescription})`,
    },
    "fact-types": {
      type: "string",
      description:
        "Comma-separated public fact type filter, such as churn_risk, contact_departure, or contact_position_change",
    },
    "fact-categories": {
      type: "string",
      description: `Comma-separated fact category filter (${toolFactCategories.join(", ")})`,
    },
    ...factIncludeArg,
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

    const invalidStatuses = invalidValues(statuses, toolFactStatuses)
    if (invalidStatuses.length > 0) {
      return outputError(
        {
          message: `Unknown fact statuses: ${invalidStatuses.join(", ")}. Allowed: ${toolFactStatuses.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const sourceTypeResult = sourceTypes
      ? toWireSourceTypes(sourceTypes, { sourceTools: false })
      : undefined
    if (sourceTypeResult && !sourceTypeResult.ok) {
      return outputError(
        {
          message: `Unknown source types: ${sourceTypeResult.invalid.join(", ")}. Allowed: ${toolSourceTypes.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const invalidFactTypes = invalidValues(factTypes, toolFactTypes)
    if (invalidFactTypes.length > 0) {
      const anomalyFactTypes = invalidFactTypes.filter((value) =>
        unsupportedFactTypes.includes(value),
      )
      const unknownFactTypes = invalidFactTypes.filter(
        (value) => !unsupportedFactTypes.includes(value),
      )
      const messageParts: string[] = []

      if (anomalyFactTypes.length > 0) {
        messageParts.push(
          `Anomaly detector fact types are not supported as public filters: ${anomalyFactTypes.join(", ")}. Use public fact types such as churn_risk, product_usage, contact_departure, or contact_position_change.`,
        )
      }

      if (unknownFactTypes.length > 0) {
        messageParts.push(
          `Unknown fact types: ${unknownFactTypes.join(", ")}. Allowed: ${toolFactTypes.join(", ")}`,
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

    const invalidFactCategories = invalidValues(factCategories, toolFactCategories)
    if (invalidFactCategories.length > 0) {
      return outputError(
        {
          message: `Unsupported fact categories: ${invalidFactCategories.join(", ")}. Allowed: ${toolFactCategories.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const include = readFactIncludes(args.include, json)

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

    // v2 puts every filter under `filters`, in lowercase.
    const filters: Record<string, unknown> = {}
    if (statuses) filters.status = statuses
    if (sourceTypeResult?.ok) filters.sourceTypes = sourceTypeResult.types
    if (factTypes) filters.types = factTypes
    if (factCategories) filters.categories = factCategories
    if (args.after) filters.after = args.after
    if (args.before) filters.before = args.before
    const params: Record<string, unknown> = { customer: args.customer }
    if (Object.keys(filters).length > 0) params.filters = filters
    if (include) params.include = include
    applyPagination(params, args, json)

    return runTool(client, publicToolContracts.outlit_list_facts.toolName, params, json, {
      transform: annotateFactFilterability,
    })
  },
})
