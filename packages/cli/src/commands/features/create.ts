import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { newIdempotencyKey } from "../../lib/idempotency-key"
import {
  optionalTrimmedString,
  requiredString,
  requiredTrimmedString,
} from "../../lib/platform-input"
import { parsePropertyFilters } from "./input"

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create or idempotently return one Feature observed by one exact event rule.",
      "Outlit creates the supporting weekly event-count and active-days metrics internally.",
      "",
      "Examples:",
      "  outlit features create --source-key metric_source_v1_0123456789abcdef0123456789abcdef --event-name report_exported --feature-key reports_exported --name 'Reports exported' --json",
      '  outlit features create --source-key metric_source_v1_0123456789abcdef0123456789abcdef --event-name report_exported --feature-key production_reports_exported --name \'Production reports exported\' --property-filters \'[{"property":"environment","operator":"equals","value":{"type":"string","value":"production"}}]\' --json',
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "source-key": { type: "string", description: "Product-event source key" },
    "event-name": { type: "string", description: "Exact tracked event name" },
    "feature-key": { type: "string", description: "Stable lower_snake_case feature key" },
    name: { type: "string", description: "Human-readable Feature name" },
    "idempotency-key": {
      type: "string",
      description: "Stable retry key: the same id returns the first result (default: a new one)",
    },
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
      publicToolContracts.outlit_create_feature.toolName,
      {
        sourceKey: requiredTrimmedString(args["source-key"], "--source-key", json),
        eventName: requiredString(args["event-name"], "--event-name", json),
        featureKey: requiredTrimmedString(args["feature-key"], "--feature-key", json),
        name: requiredTrimmedString(args.name, "--name", json),
        propertyFilters: parsePropertyFilters(args["property-filters"], json),
        idempotencyKey: optionalTrimmedString(args["idempotency-key"]) ?? newIdempotencyKey(),
      },
      json,
      { spinnerMessage: "Creating Feature..." },
    )
  },
})
