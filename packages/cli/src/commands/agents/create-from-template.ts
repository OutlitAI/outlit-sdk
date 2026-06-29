import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "create-from-template",
    description: [
      "Create a draft agent from a platform template.",
      "",
      "Outputs the full platform command envelope, including safety details.",
      "",
      "Examples:",
      "  outlit agents create-from-template churn --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    template: {
      type: "positional",
      description: "Agent template key to create, such as churn",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      "outlit_agent_create_from_template",
      {
        source: { type: "template", templateKey: args.template },
        mode: "draft",
      },
      json,
      {
        spinnerMessage: "Creating agent template draft...",
      },
    )
  },
})
