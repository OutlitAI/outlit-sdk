import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "sources",
    description: [
      "List product-event sources eligible for Behavior Metrics.",
      "",
      "Use the returned source key with `outlit metrics events --source <source-key>`.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: { ...authArgs, ...outputArgs },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, "outlit_list_behavior_metric_sources", {}, json, {
      spinnerMessage: "Loading Behavior Metric sources...",
    })
  },
})
