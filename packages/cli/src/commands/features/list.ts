import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { optionalTrimmedString } from "../../lib/platform-input"
import { parseBoundedInteger } from "./input"

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List configured Features, their exact historical usage, and event candidates.",
      "When exactly one eligible source exists, Core selects it automatically.",
      "Candidate discovery returns ready or partial items, or an unavailable reason.",
      "Unavailable evidence remains distinct from zero usage.",
      "",
      "Examples:",
      "  outlit features list --json",
      "  outlit features list --source metric_source_v1_0123456789abcdef0123456789abcdef --weeks 4 --candidate-limit 20 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    source: { type: "string", description: "Optional product-event source key" },
    weeks: { type: "string", description: "Historical usage window in weeks (1-53, default: 12)" },
    "candidate-limit": {
      type: "string",
      description: "Maximum event candidates (1-100, default: 100)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input: Record<string, unknown> = {
      weeks: parseBoundedInteger(args.weeks, 12, "--weeks", 1, 53, json),
      candidateLimit: parseBoundedInteger(
        args["candidate-limit"],
        100,
        "--candidate-limit",
        1,
        100,
        json,
      ),
    }
    const sourceKey = optionalTrimmedString(args.source)
    if (sourceKey) input.sourceKey = sourceKey

    return runTool(client, publicToolContracts.outlit_list_features.toolName, input, json, {
      spinnerMessage: "Loading Features...",
    })
  },
})
