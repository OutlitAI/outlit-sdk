import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, pageSizeArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString } from "../../lib/platform-input"

const sources = publicToolContracts.outlit_list_customer_fields.inputSchema.properties.source.enum

export default defineCommand({
  meta: {
    name: "list",
    description: [
      publicToolContracts.outlit_list_customer_fields.description,
      "",
      `Sources: ${sources.join(", ")}`,
      "",
      "Examples:",
      "  outlit customer-fields list",
      "  outlit customer-fields list --source hubspot --search health --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...pageSizeArgs,
    source: { type: "string", description: `Only this source's fields (${sources.join(", ")})` },
    search: {
      type: "string",
      description: "Only fields whose key or label contains this text, ignoring case",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const params: Record<string, unknown> = {}
    const source = optionalTrimmedString(args.source)?.toLowerCase()
    if (source) {
      if (!(sources as readonly string[]).includes(source)) {
        return outputError(
          { message: `--source must be one of: ${sources.join(", ")}`, code: "invalid_input" },
          json,
        )
      }
      params.source = source
    }
    const search = optionalTrimmedString(args.search)
    if (search) params.search = search
    applyPagination(params, args, json)

    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_list_customer_fields.toolName, params, json, {
      spinnerMessage: "Loading customer fields...",
    })
  },
})
