import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import {
  optionalTrimmedString,
  parseCsvList,
  parseIntegerFlag,
  requiredTrimmedString,
} from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "create-custom",
    description: [
      "Create a custom hosted Outlit agent.",
      "",
      "Examples:",
      "  outlit agents create-custom --display-name 'Renewal risk' --instructions 'Find risk' --surface-criteria 'Surface risky customers' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "display-name": { type: "string", description: "Agent display name" },
    instructions: { type: "string", description: "Agent instructions" },
    "surface-criteria": { type: "string", description: "Criteria for surfacing items" },
    "skip-criteria": { type: "string", description: "Optional criteria for skipping items" },
    "max-items-to-surface": {
      type: "string",
      description: "Maximum items the agent should surface per run",
    },
    "action-keys": { type: "string", description: "Comma-separated action keys" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const input = {
      displayName: requiredTrimmedString(args["display-name"], "--display-name", json),
      instructions: requiredTrimmedString(args.instructions, "--instructions", json),
      surfaceCriteria: requiredTrimmedString(args["surface-criteria"], "--surface-criteria", json),
      ...(optionalTrimmedString(args["skip-criteria"])
        ? { skipCriteria: optionalTrimmedString(args["skip-criteria"]) }
        : {}),
      maxItemsToSurface: parseIntegerFlag(
        args["max-items-to-surface"],
        10,
        "--max-items-to-surface",
        json,
      ),
      actionKeys: parseCsvList(args["action-keys"]),
    }

    return runTool(client, "outlit_agent_create_custom", input, json, {
      spinnerMessage: "Creating custom agent...",
    })
  },
})
