import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, paginationArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString, parseCsvList } from "../../lib/platform-input"
import { parseBoundedInteger } from "./input"

const includeSections = ["usage", "candidates"] as const

/** --include as a list of sections; both by default, since this command has always shown both. */
function parseInclude(value: string | undefined, json: boolean) {
  if (value === undefined) return [...includeSections]
  const requested = parseCsvList(value)
  const sections = requested.filter((entry): entry is (typeof includeSections)[number] =>
    includeSections.some((section) => section === entry),
  )
  if (sections.length !== requested.length) {
    return outputError(
      { message: `--include must list: ${includeSections.join(", ")}`, code: "invalid_input" },
      json,
    )
  }
  return sections
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Features, their exact historical usage, and event candidates.",
      "When exactly one eligible source exists, Core selects it automatically.",
      "Candidate discovery returns complete or partial items, or an unavailable reason.",
      "Unavailable evidence remains distinct from zero usage.",
      "",
      "Examples:",
      "  outlit features list --json",
      "  outlit features list --source metric_source_v1_0123456789abcdef0123456789abcdef --weeks 4 --candidate-limit 20 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    source: { type: "string", description: "Optional product-event source key" },
    weeks: { type: "string", description: "Historical usage window in weeks (1-53, default: 12)" },
    "candidate-limit": {
      type: "string",
      description: "Maximum event candidates (1-100, default: 25)",
    },
    include: {
      type: "string",
      description: "Comma-separated extras to read: usage, candidates (default: usage,candidates)",
    },
    search: {
      type: "string",
      description: "Only event candidates whose event name contains this text",
    },
    ...paginationArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input: Record<string, unknown> = {
      weeks: parseBoundedInteger(args.weeks, 12, "--weeks", 1, 53, json),
      include: parseInclude(args.include, json),
    }
    if (args["candidate-limit"] !== undefined) {
      input.candidateLimit = parseBoundedInteger(
        args["candidate-limit"],
        25,
        "--candidate-limit",
        1,
        100,
        json,
      )
    }
    const filters: Record<string, string> = {}
    const sourceKey = optionalTrimmedString(args.source)
    if (sourceKey) filters.sourceKey = sourceKey
    const eventSearch = optionalTrimmedString(args.search)
    if (eventSearch) filters.eventSearch = eventSearch
    if (Object.keys(filters).length > 0) input.filters = filters
    applyPagination(input, args, json)

    return runTool(client, publicToolContracts.outlit_list_features.toolName, input, json, {
      spinnerMessage: "Loading Features...",
    })
  },
})
