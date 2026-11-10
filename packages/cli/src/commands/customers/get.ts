import { customerIncludeSections, customerTimeframes, publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { splitCsv } from "../../lib/config"
import { outputError } from "../../lib/output"
import { parseBoundedInteger } from "../features/input"

type SectionArgs = {
  weeks?: string
  weekly?: boolean
  limit?: string
  cursor?: string
}

type Section = "features" | "meters" | "credits"
const usageSections: readonly Section[] = ["features", "meters"]
const pagedSections: readonly Section[] = ["features", "meters", "credits"]

/**
 * The page and window options for the sections that take them, from --weeks, --weekly, --limit and
 * --cursor, keyed by section. Each goes to the sections it applies to; a flag that no requested
 * section takes is an error rather than silently dropped.
 */
export function readSectionOptions(
  args: SectionArgs,
  include: readonly string[] | undefined,
  json: boolean,
): Record<string, Record<string, unknown>> {
  if (!(args.weeks || args.weekly || args.limit || args.cursor)) return {}

  const requested = new Set(include ?? [])
  const usage = usageSections.filter((section) => requested.has(section))
  const paged = pagedSections.filter((section) => requested.has(section))

  if ((args.weeks || args.weekly) && usage.length === 0) {
    return outputError(
      {
        message: "--weeks and --weekly go with --include features or meters",
        code: "invalid_input",
      },
      json,
    )
  }
  if ((args.limit || args.cursor) && paged.length === 0) {
    return outputError(
      {
        message: "--limit and --cursor go with --include features, meters or credits",
        code: "invalid_input",
      },
      json,
    )
  }
  if (args.cursor && paged.length > 1) {
    return outputError(
      {
        message: `--cursor continues one section; include only one of ${pagedSections.join(", ")}`,
        code: "invalid_input",
      },
      json,
    )
  }

  const weeks = args.weeks ? parseBoundedInteger(args.weeks, 12, "--weeks", 1, 53, json) : undefined
  const limit = args.limit
    ? parseBoundedInteger(args.limit, 25, "--limit", 1, 100, json)
    : undefined
  const options: Record<string, Record<string, unknown>> = {}
  for (const section of paged) {
    options[section] = {
      ...(usage.includes(section) && weeks !== undefined ? { weeks } : {}),
      ...(usage.includes(section) && args.weekly ? { weekly: true } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(args.cursor ? { cursor: args.cursor } : {}),
    }
  }
  return options
}

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get details for a customer by ID, domain, or name.",
      "",
      "The customer argument accepts:",
      "  - Customer domain (acme.com)",
      "  - Customer ID (UUID)",
      "  - Customer name (partial match)",
      "",
      'The primary record is returned under "customer". Each included section (such as "users")',
      "is {status, asOf, data}, or a status and reason when there is nothing to show.",
      "features, meters and credits come in pages: --limit sets the page size, and --cursor",
      "continues one of them (the section's page.nextCursor).",
      "",
      `Available include sections: ${customerIncludeSections.join(", ")}`,
      `Timeframes: ${customerTimeframes.join(", ")}`,
      "",
      "Examples:",
      "  outlit customers get acme.com",
      "  outlit customers get acme.com --include users,revenue",
      "  outlit customers get acme.com --include users,revenue,recentTimeline --timeframe 90d",
      "  outlit customers get acme.com --include billing --subscriptions all",
      "  outlit customers get acme.com --include relationship,credits",
      "  outlit customers get acme.com --include features,meters --weeks 6 --weekly",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customer: {
      type: "positional",
      description: "Customer ID, domain (acme.com), or name",
      required: true,
    },
    include: {
      type: "string",
      description: [
        "Comma-separated sections to include in response.",
        `Available: ${customerIncludeSections.join(", ")}`,
        'Included sections use their contract keys, such as "users" and "revenue".',
      ].join("\n"),
    },
    timeframe: {
      type: "string",
      description: "Timeframe for metrics (7d, 14d, 30d, 90d)",
      default: "30d",
    },
    subscriptions: {
      type: "string",
      description:
        "With --include billing: live (default) or all, which adds the most recently canceled subscriptions",
    },
    weeks: {
      type: "string",
      description: "With --include features or meters: weeks of history (1-53, default: 12)",
    },
    weekly: {
      type: "boolean",
      description: "With --include features or meters: add each item's week-by-week usage",
      default: false,
    },
    limit: {
      type: "string",
      description:
        "With --include features, meters or credits: items per page (1-100, default: 25)",
    },
    cursor: {
      type: "string",
      description:
        "With one of --include features, meters or credits: the section's page.nextCursor",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {
      customer: args.customer,
      timeframe: args.timeframe,
    }

    if (args.include) {
      params.include = splitCsv(args.include)
    }
    if (args.subscriptions) {
      params.subscriptions = args.subscriptions
    }
    Object.assign(params, readSectionOptions(args, params.include as string[] | undefined, json))

    return runTool(client, publicToolContracts.outlit_get_customer.toolName, params, json)
  },
})
