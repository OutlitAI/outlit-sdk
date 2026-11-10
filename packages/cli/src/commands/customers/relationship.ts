import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

// The previous command for `customers get <customer> --include relationship`, kept so scripts keep
// working. Hidden from help and completions; the output is the get_customer result.
export default defineCommand({
  meta: {
    name: "relationship",
    hidden: true,
    description: [
      "Renamed: use `outlit customers get <customer> --include relationship`.",
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
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_get_customer",
      {
        customer: requiredTrimmedString(args.customer, "<customer>", json),
        include: ["relationship"],
      },
      json,
    )
  },
})
