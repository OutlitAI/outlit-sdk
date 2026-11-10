import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"
import { parseBoundedInteger } from "../features/input"

// The previous command for `customers get <customer> --include features,meters`, kept so scripts
// keep working. Hidden from help and completions; the output is the get_customer result.
export default defineCommand({
  meta: {
    name: "features",
    hidden: true,
    description: [
      "Renamed: use `outlit customers get <customer> --include features,meters`.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    customer: {
      type: "positional",
      description: "Customer ID, domain (acme.com), or exact name",
      required: true,
    },
    weeks: { type: "string", description: "Historical usage window in weeks (1-53, default: 12)" },
    weekly: {
      type: "boolean",
      description: "Include weekly usage",
      default: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const window = {
      ...(args.weeks ? { weeks: parseBoundedInteger(args.weeks, 12, "--weeks", 1, 53, json) } : {}),
      ...(args.weekly ? { weekly: true } : {}),
    }
    return runTool(
      client,
      "outlit_get_customer",
      {
        customer: requiredTrimmedString(args.customer, "<customer>", json),
        include: ["features", "meters"],
        ...(Object.keys(window).length > 0 ? { features: window, meters: window } : {}),
      },
      json,
      { spinnerMessage: "Loading customer feature usage..." },
    )
  },
})
