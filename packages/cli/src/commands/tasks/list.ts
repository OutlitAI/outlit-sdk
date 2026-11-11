import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { applyPagination, pageSizeArgs } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString } from "../../lib/platform-input"

const sections = publicToolContracts.outlit_list_tasks.inputSchema.properties.section.enum

export default defineCommand({
  meta: {
    name: "list",
    description: [
      publicToolContracts.outlit_list_tasks.description,
      "",
      `Sections: ${sections.join(", ")} (default: today)`,
      "",
      "Examples:",
      "  outlit tasks list",
      "  outlit tasks list --section open --customer acme.com --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...pageSizeArgs,
    section: { type: "string", description: `Section to read (${sections.join(", ")})` },
    customer: { type: "string", description: "Only this customer's tasks (ID, domain or name)" },
    owner: {
      type: "string",
      description: "Admins: a teammate's member ID (today and open only)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const params: Record<string, unknown> = {}
    const section = optionalTrimmedString(args.section)?.toLowerCase()
    if (section) {
      if (!(sections as readonly string[]).includes(section)) {
        return outputError(
          { message: `--section must be one of: ${sections.join(", ")}`, code: "invalid_input" },
          json,
        )
      }
      params.section = section
    }
    const customer = optionalTrimmedString(args.customer)
    if (customer) params.customer = customer
    const owner = optionalTrimmedString(args.owner)
    if (owner) params.filters = { owner }
    applyPagination(params, args, json)

    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, publicToolContracts.outlit_list_tasks.toolName, params, json, {
      spinnerMessage: "Loading tasks...",
    })
  },
})
