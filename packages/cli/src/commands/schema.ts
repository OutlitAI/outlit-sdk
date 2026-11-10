import { schemaTables } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { outputError } from "../lib/output"

/** The extra topics the schema tool answers besides one view: what to pass as `topic`. */
const topicNames = {
  examples: "examples",
  events: "event_types",
  event_types: "event_types",
} as const

function schemaParams(topic: string | undefined): Record<string, unknown> | undefined {
  if (!topic) return {}
  const name = topic.toLowerCase()
  if ((schemaTables as readonly string[]).includes(name)) return { topic: "view", view: name }
  if (Object.hasOwn(topicNames, name)) {
    return { topic: topicNames[name as keyof typeof topicNames] }
  }
  return undefined
}

export default defineCommand({
  meta: {
    name: "schema",
    description: [
      "Describe what `outlit sql` can read.",
      "",
      "Without an argument, returns every view with its columns (type, nullability, unit, currency",
      "and decimals columns, time zone) and its rules (what a row is, deletion, freshness, duplicates).",
      "With a view name, returns that view. With `events`, returns the activity channels and event",
      "types plus your workspace's most frequent event names. With `examples`, returns worked queries",
      "that run as written.",
      "",
      `Available views: ${schemaTables.join(", ")}`,
      "",
      "Examples:",
      "  outlit schema",
      "  outlit schema activity",
      "  outlit schema events",
      "  outlit schema examples --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    view: {
      type: "positional",
      description: `View to describe (${schemaTables.join(", ")}), or events or examples. Optional.`,
      required: false,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const params = schemaParams(args.view)
    if (!params) {
      return outputError(
        {
          message: `Unknown view or topic "${args.view}". Use one of: ${[...schemaTables, "events", "examples"].join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(client, "outlit_get_schema", params, json)
  },
})
