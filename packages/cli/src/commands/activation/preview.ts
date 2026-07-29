import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import {
  activationDefinitionArgs,
  activationPreviewArgs,
  parseActivationDefinition,
  parseActivationPreviewOptions,
} from "../../lib/activation"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "preview",
    description: [
      "Historically preview a company activation definition without mutation.",
      "",
      "Preview is read-only: it never saves configuration or materializes activation.",
      "",
      "Examples:",
      "  outlit activation preview --signal 10000000-0000-4000-8000-000000000001 --json",
      "  outlit activation preview --signals 10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002 --match ALL --window 30d --lookback-days 60 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...activationDefinitionArgs,
    ...activationPreviewArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const definition = parseActivationDefinition(args, json)
    const options = parseActivationPreviewOptions(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_activation_preview", { definition, ...options }, json, {
      spinnerMessage: "Previewing company activation...",
    })
  },
})
