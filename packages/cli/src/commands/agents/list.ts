import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { truncate } from "../../lib/format"
import { joinList } from "./format"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Outlit agents.",
      "",
      "Examples:",
      "  outlit agents list",
      "  outlit agents list --json",
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

    return runTool(client, "outlit_agent_list", {}, json, {
      spinnerMessage: "Fetching agents...",
      table: {
        itemsKey: "result.data.agents",
        columns: [
          { header: "ID", key: "id", format: (v) => truncate(v, 22) },
          { header: "Name", key: "displayName", format: (v) => truncate(v, 28) },
          { header: "Status", key: "status" },
          { header: "Agent Key", key: "agentKey", format: (v) => truncate(v, 28) },
          { header: "Template", key: "templateVersion" },
          { header: "Actions", key: "actionKeys", format: joinList },
        ],
      },
    })
  },
})
