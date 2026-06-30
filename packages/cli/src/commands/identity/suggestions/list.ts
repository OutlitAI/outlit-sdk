import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"
import { relativeDate, truncate } from "../../../lib/format"

const statuses = ["suggested", "processing", "merged", "rejected"] as const
const confidences = ["HIGH", "MEDIUM", "LOW"] as const

function formatCustomerName(value: unknown): string {
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name
    return typeof name === "string" ? truncate(name, 24) : "--"
  }

  return "--"
}

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List customer identity merge suggestions.",
      "",
      "Examples:",
      "  outlit identity suggestions list",
      "  outlit identity suggestions list --status suggested --confidence HIGH --limit 10 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    status: {
      type: "string",
      description: `Filter by status: ${statuses.join(", ")}`,
    },
    confidence: {
      type: "string",
      description: `Filter by confidence: ${confidences.join(", ")}`,
    },
    limit: {
      type: "string",
      description: "Maximum suggestions to return, 1-100",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const params: Record<string, unknown> = {}

    if (args.status) {
      params.status = args.status
    }
    if (args.confidence) {
      params.confidence = args.confidence
    }
    if (args.limit) {
      params.limit = Number(args.limit)
    }

    return runTool(client, "outlit_identity_merge_suggestion_list", params, json, {
      spinnerMessage: "Fetching identity merge suggestions...",
      table: {
        itemsKey: "result.data.suggestions",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Status", key: "status" },
          { header: "Confidence", key: "confidence" },
          { header: "Survivor", key: "survivor", format: formatCustomerName },
          { header: "Duplicate", key: "duplicate", format: formatCustomerName },
          { header: "Created", key: "createdAt", format: relativeDate },
        ],
      },
    })
  },
})
