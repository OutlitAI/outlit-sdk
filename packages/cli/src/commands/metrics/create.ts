import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { errorMessage, outputError } from "../../lib/output"
import { requiredString, requiredTrimmedString } from "../../lib/platform-input"

function parsePropertyFilters(value: string | undefined, json: boolean): unknown[] {
  if (!value?.trim()) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return outputError(
        { message: "--property-filters must be a JSON array", code: "invalid_input" },
        json,
      )
    }
    return parsed
  } catch (error) {
    return outputError(
      {
        message: `Invalid --property-filters JSON: ${errorMessage(error, "parse failed")}`,
        code: "invalid_input",
      },
      json,
    )
  }
}

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create an event-based Outlit Behavior Metric.",
      "",
      "Examples:",
      "  outlit metrics create --source metric_source_v1_0123456789abcdef0123456789abcdef --event report_exported --key reports_exported --label 'Reports exported' --json",
      '  outlit metrics create --source metric_source_v1_0123456789abcdef0123456789abcdef --event report_exported --key production_reports_exported --label \'Production reports exported\' --property-filters \'[{"property":"environment","operator":"equals","value":{"type":"string","value":"production"}}]\' --json',
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    source: { type: "string", description: "Behavior Metric source key" },
    event: { type: "string", description: "Exact tracked event name" },
    key: { type: "string", description: "Stable lower_snake_case metric key" },
    label: { type: "string", description: "Human-readable metric label" },
    "property-filters": {
      type: "string",
      description: "Optional JSON array of event property filters",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input = {
      sourceKey: requiredTrimmedString(args.source, "--source", json),
      eventName: requiredString(args.event, "--event", json),
      behaviorKey: requiredTrimmedString(args.key, "--key", json),
      label: requiredTrimmedString(args.label, "--label", json),
      propertyFilters: parsePropertyFilters(args["property-filters"], json),
    }

    return runTool(client, "outlit_create_behavior_metric", input, json, {
      spinnerMessage: "Creating Behavior Metric...",
    })
  },
})
