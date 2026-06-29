import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import {
  optionalTrimmedString,
  parseCsvList,
  parseIntegerFlag,
  requiredTrimmedString,
} from "../../lib/platform-input"

function hasCustomAgentFlags(args: Record<string, unknown>): boolean {
  return [
    "display-name",
    "instructions",
    "surface-criteria",
    "skip-criteria",
    "max-items-to-surface",
    "action-keys",
  ].some((key) => args[key] !== undefined)
}

export default defineCommand({
  meta: {
    name: "create",
    description: [
      "Create an Outlit agent.",
      "",
      "Use --template to create from a supported template, or --type custom for a custom hosted agent.",
      "",
      "Examples:",
      "  outlit agents create --template churn --json",
      "  outlit agents create --type custom --display-name 'Renewal risk' --instructions 'Find risk' --surface-criteria 'Surface risky customers' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    template: {
      type: "string",
      description: "Agent template key to create, such as churn",
    },
    type: {
      type: "string",
      description: "Agent type to create. Currently supports: custom",
    },
    "display-name": { type: "string", description: "Custom agent display name" },
    instructions: { type: "string", description: "Custom agent instructions" },
    "surface-criteria": { type: "string", description: "Criteria for surfacing items" },
    "skip-criteria": { type: "string", description: "Optional criteria for skipping items" },
    "max-items-to-surface": {
      type: "string",
      description: "Maximum items the custom agent should surface per run",
    },
    "action-keys": { type: "string", description: "Comma-separated custom agent action keys" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const template = optionalTrimmedString(args.template)
    const type = optionalTrimmedString(args.type)

    if (template && type) {
      return outputError(
        { message: "Use either --template or --type custom, not both", code: "invalid_input" },
        json,
      )
    }

    if (template) {
      if (hasCustomAgentFlags(args)) {
        return outputError(
          {
            message: "Custom agent flags cannot be used with --template",
            code: "invalid_input",
          },
          json,
        )
      }

      return runTool(
        client,
        "outlit_agent_create",
        { type: "template", templateKey: template, mode: "draft" },
        json,
        {
          spinnerMessage: "Creating agent...",
        },
      )
    }

    if (type !== "custom") {
      return outputError(
        {
          message: "Provide --template or --type custom",
          code: type ? "invalid_input" : "missing_input",
        },
        json,
      )
    }

    const input = {
      type: "custom",
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

    return runTool(client, "outlit_agent_create", input, json, {
      spinnerMessage: "Creating agent...",
    })
  },
})
