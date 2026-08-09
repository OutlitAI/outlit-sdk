import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { parseIntegerFlag, requiredTrimmedString } from "../../lib/platform-input"

function parseBoundedInteger(
  value: string | number | undefined,
  fallback: number,
  flag: string,
  min: number,
  max: number,
  json: boolean,
): number {
  const parsed = parseIntegerFlag(value, fallback, flag, json)
  if (parsed < min || parsed > max) {
    return outputError(
      { message: `${flag} must be an integer from ${min} to ${max}`, code: "invalid_input" },
      json,
    )
  }
  return parsed
}

export default defineCommand({
  meta: {
    name: "events",
    description: [
      "List attributed event candidates for a Behavior Metric source.",
      "",
      "Examples:",
      "  outlit metrics events --source metric_source_v1_0123456789abcdef0123456789abcdef --json",
      "  outlit metrics events --source metric_source_v1_0123456789abcdef0123456789abcdef --weeks 4 --limit 20 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    source: { type: "string", description: "Behavior Metric source key" },
    weeks: { type: "string", description: "History window in weeks (1-53, default: 12)" },
    limit: { type: "string", description: "Maximum event candidates (1-100, default: 100)" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(
      client,
      "outlit_list_behavior_metric_events",
      {
        sourceKey: requiredTrimmedString(args.source, "--source", json),
        weeks: parseBoundedInteger(args.weeks, 12, "--weeks", 1, 53, json),
        limit: parseBoundedInteger(args.limit, 100, "--limit", 1, 100, json),
      },
      json,
      { spinnerMessage: "Loading Behavior Metric events..." },
    )
  },
})
