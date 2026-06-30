import { defineCommand } from "citty"
import { authArgs } from "../../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../../args/output"
import { getClientOrExit, runTool } from "../../../lib/api"
import { outputError } from "../../../lib/output"
import { optionalTrimmedString } from "../../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update Outlit report settings.",
      "",
      "Examples:",
      "  outlit settings report update --slack-channel-id C123 --slack-channel-name sales-alerts --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "slack-channel-id": {
      type: "string",
      description: "Slack channel ID for reports",
    },
    "slack-channel-name": {
      type: "string",
      description: "Slack channel name for reports",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const slackChannelId = optionalTrimmedString(args["slack-channel-id"])
    const slackChannelName = optionalTrimmedString(args["slack-channel-name"])

    if (!slackChannelId || !slackChannelName) {
      return outputError(
        {
          message: "Provide both --slack-channel-id and --slack-channel-name",
          code: "missing_input",
        },
        json,
      )
    }

    return runTool(
      client,
      "outlit_settings_report_update",
      {
        slackChannelId,
        slackChannelName,
      },
      json,
      {
        spinnerMessage: "Updating report settings...",
      },
    )
  },
})
