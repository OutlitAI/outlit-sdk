import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import {
  activationDefinitionArgs,
  activationToolNames,
  parseActivationSetDefinition,
} from "../../lib/activation"
import { getClientOrExit, runTool } from "../../lib/api"

export default defineCommand({
  meta: {
    name: "set",
    description: [
      "Explicitly configure Core-derived, monotonic company activation.",
      "",
      "Company activation is separate from contact journey stages. Core evaluates ordinary",
      "customer-grain signals; SDKs do not authoritatively activate a company.",
      "",
      "Use --disable by itself to stop future evaluation. Existing activation timestamps",
      "and milestones are preserved.",
      "",
      "Examples:",
      "  outlit activation set --signal 10000000-0000-4000-8000-000000000001 --json",
      "  outlit activation set --signals 10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002 --match AT_LEAST --threshold 2 --window 168h --json",
      "  outlit activation set --disable --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...activationDefinitionArgs,
    disable: {
      type: "boolean",
      description: "Disable future company activation evaluation without clearing history",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const definition = parseActivationSetDefinition(args, json)
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, activationToolNames.set, { definition }, json, {
      spinnerMessage:
        definition === null ? "Disabling company activation..." : "Saving company activation...",
    })
  },
})
