import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"
import { parseBoundedInteger } from "../features/input"

export default defineCommand({
  meta: {
    name: "features",
    description: [
      "Read exact historical Feature usage for one authorized customer.",
      "Unavailable source evidence remains distinct from no matches in the requested window.",
      "",
      "The customer argument accepts a customer domain, UUID, or exact name.",
      "",
      "Examples:",
      "  outlit customers features acme.com --json",
      "  outlit customers features acme.com --weeks 6 --json",
      "  outlit customers features acme.com --weeks 53 --weekly --json",
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
      description: "Include ordered weekly event counts and active days",
      default: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_get_customer_features.toolName,
      {
        customer: requiredTrimmedString(args.customer, "<customer>", json),
        weeks: parseBoundedInteger(args.weeks, 12, "--weeks", 1, 53, json),
        ...(args.weekly ? { includeWeeklyUsage: true } : {}),
      },
      json,
      { spinnerMessage: "Loading customer feature usage..." },
    )
  },
})
