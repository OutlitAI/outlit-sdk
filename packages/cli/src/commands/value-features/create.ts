import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredString, requiredTrimmedString } from "../../lib/platform-input"
import { parsePropertyFilters } from "./input"

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create or idempotently return one Value Feature observed by one exact event rule.",
      "",
      "Examples:",
      "  outlit value-features create --source metric_source_v1_0123456789abcdef0123456789abcdef --event report_exported --key reports_exported --name 'Reports exported' --json",
      '  outlit value-features create --source metric_source_v1_0123456789abcdef0123456789abcdef --event report_exported --key production_reports_exported --name \'Production reports exported\' --property-filters \'[{"property":"environment","operator":"equals","value":{"type":"string","value":"production"}}]\' --json',
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    source: { type: "string", description: "Product-event source key" },
    event: { type: "string", description: "Exact tracked event name" },
    key: { type: "string", description: "Stable lower_snake_case feature key" },
    name: { type: "string", description: "Human-readable Value Feature name" },
    "property-filters": {
      type: "string",
      description: "Optional JSON array of exact or exists property filters",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_create_value_feature.toolName,
      {
        sourceKey: requiredTrimmedString(args.source, "--source", json),
        eventName: requiredString(args.event, "--event", json),
        featureKey: requiredTrimmedString(args.key, "--key", json),
        name: requiredTrimmedString(args.name, "--name", json),
        propertyFilters: parsePropertyFilters(args["property-filters"], json),
      },
      json,
      { spinnerMessage: "Creating Value Feature..." },
    )
  },
})
