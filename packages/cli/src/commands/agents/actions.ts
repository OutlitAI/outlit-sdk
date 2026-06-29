import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { truncate } from "../../lib/format"
import { joinList } from "./format"

export default defineCommand({
  meta: {
    name: "actions",
    description: [
      "List available agent configuration actions.",
      "",
      "Examples:",
      "  outlit agents actions",
      "  outlit agents actions --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_agent_list_available_actions", {}, json, {
      spinnerMessage: "Fetching agent configuration actions...",
      table: {
        itemsKey: "result.data.actions",
        columns: [
          { header: "Key", key: "key" },
          { header: "Label", key: "label", format: (v) => truncate(v, 32) },
          { header: "Category", key: "category" },
          { header: "Subject Types", key: "subjectTypes", format: joinList },
          { header: "Version", key: "version" },
        ],
      },
    })
  },
})
