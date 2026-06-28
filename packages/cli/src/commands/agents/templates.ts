import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { truncate } from "../../lib/format"
import { joinList } from "./format"

export default defineCommand({
  meta: {
    name: "templates",
    description: [
      "List available agent templates.",
      "",
      "Examples:",
      "  outlit agents templates",
      "  outlit agents templates --json",
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

    return runTool(client, "outlit_agent_list_templates", {}, json, {
      spinnerMessage: "Fetching agent templates...",
      table: {
        itemsKey: "result.data.templates",
        columns: [
          { header: "Key", key: "key" },
          { header: "Name", key: "name", format: (v) => truncate(v, 28) },
          { header: "Version", key: "version" },
          { header: "Creates", key: "creates", format: joinList },
          { header: "Default Mode", key: "defaultMode" },
          { header: "Supported Modes", key: "supportedModes", format: joinList },
        ],
      },
    })
  },
})
