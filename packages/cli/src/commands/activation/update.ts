import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { activationDefinitionArgs, parseActivationDefinition } from "../../lib/activation"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update Core-derived, monotonic company activation.",
      "",
      "Company activation is separate from contact journey stages. Core evaluates ordinary",
      "customer-grain signals; SDKs do not authoritatively activate a company.",
      "The selected signals must already exist; this command does not create them.",
      "",
      "Examples:",
      "  outlit activation update --signal 10000000-0000-4000-8000-000000000001 --json",
      "  outlit activation update --signals 10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002 --match AT_LEAST --threshold 2 --window 168h --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...activationDefinitionArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const definition = parseActivationDefinition(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_activation_update", { definition }, json, {
      spinnerMessage: "Updating company activation...",
    })
  },
})
