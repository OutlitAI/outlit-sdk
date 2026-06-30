import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update Outlit workspace settings.",
      "",
      "Examples:",
      "  outlit settings update --default-timezone America/Los_Angeles --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "default-timezone": {
      type: "string",
      description: "Default IANA timezone for the workspace",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const defaultTimezone = requiredTrimmedString(
      args["default-timezone"],
      "--default-timezone",
      json,
    )

    return runTool(client, "outlit_settings_update", { defaultTimezone }, json, {
      spinnerMessage: "Updating settings...",
    })
  },
})
