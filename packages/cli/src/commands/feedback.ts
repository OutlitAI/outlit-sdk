import { readFileSync } from "node:fs"
import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import type { SubmitFeedbackInput } from "../lib/client"
import { errorMessage, outputError } from "../lib/output"

const BODY_MAX_LENGTH = 20_000
const AREA_MAX_LENGTH = 100
const CONTEXT_MAX_BYTES = 16 * 1024

function readTextFile(path: string, flag: string, json: boolean): string {
  try {
    return readFileSync(path, "utf-8")
  } catch (error) {
    return outputError(
      {
        message: `Cannot read ${flag} file: ${errorMessage(error, "unknown error")}`,
        code: "file_error",
      },
      json,
    )
  }
}

function resolveBody(args: { body?: string; bodyFile?: string }, json: boolean): string {
  if (args.body !== undefined && args.bodyFile !== undefined) {
    return outputError(
      { message: "Use either --body or --body-file, not both", code: "invalid_input" },
      json,
    )
  }
  const raw =
    args.bodyFile !== undefined ? readTextFile(args.bodyFile, "--body-file", json) : args.body
  const trimmed = raw?.trim()

  if (!trimmed) {
    return outputError({ message: "Provide --body or --body-file", code: "missing_input" }, json)
  }
  if (trimmed.length > BODY_MAX_LENGTH) {
    return outputError(
      { message: `--body must be at most ${BODY_MAX_LENGTH} characters`, code: "invalid_input" },
      json,
    )
  }
  return trimmed
}

function resolveArea(area: string | undefined, json: boolean): string | undefined {
  if (area === undefined) return undefined
  const trimmed = area.trim()
  if (!trimmed) {
    return outputError(
      { message: "--area must be a non-empty string", code: "invalid_input" },
      json,
    )
  }
  if (trimmed.length > AREA_MAX_LENGTH) {
    return outputError(
      { message: `--area must be at most ${AREA_MAX_LENGTH} characters`, code: "invalid_input" },
      json,
    )
  }
  return trimmed
}

function resolveContext(
  args: { context?: string; contextFile?: string },
  json: boolean,
): Record<string, unknown> | undefined {
  if (args.context !== undefined && args.contextFile !== undefined) {
    return outputError(
      { message: "Use either --context or --context-file, not both", code: "invalid_input" },
      json,
    )
  }
  const raw =
    args.contextFile !== undefined
      ? readTextFile(args.contextFile, "--context-file", json)
      : args.context
  if (raw === undefined) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return outputError(
      {
        message: `Invalid --context JSON: ${errorMessage(error, "parse failed")}`,
        code: "invalid_input",
      },
      json,
    )
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return outputError({ message: "--context must be a JSON object", code: "invalid_input" }, json)
  }
  if (Buffer.byteLength(JSON.stringify(parsed), "utf-8") > CONTEXT_MAX_BYTES) {
    return outputError(
      { message: "--context must serialize to at most 16 KiB", code: "invalid_input" },
      json,
    )
  }
  return parsed as Record<string, unknown>
}

export default defineCommand({
  meta: {
    name: "feedback",
    description: [
      "Submit product feedback to the Outlit team: bugs, feature ideas, or agent friction.",
      "Feedback is product intake, not a support ticket, and does not guarantee a reply.",
      "Do not include secrets or unnecessary customer data.",
      "",
      "Examples:",
      "  outlit feedback --body 'The customers merge preview did not list the losing record traits' --json",
      "  outlit feedback --body 'Add a way to export attention items' --area attention --json",
      '  outlit feedback --body \'SQL tool rejected a valid LIMIT clause\' --context \'{"surface":"cli","command":"sql"}\' --json',
      "  outlit feedback --body-file report.md --context-file diagnostics.json --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    body: {
      type: "string",
      description: "Feedback text: trimmed, non-empty, at most 20000 characters",
    },
    "body-file": {
      type: "string",
      description: "Path to a UTF-8 text file containing the feedback body",
    },
    area: {
      type: "string",
      description: "Optional product area label, at most 100 characters",
    },
    context: {
      type: "string",
      description:
        "Optional JSON object with diagnostic context, at most 16 KiB serialized. Never include secrets.",
    },
    "context-file": {
      type: "string",
      description:
        "Path to a JSON file with diagnostic context (mutually exclusive with --context)",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    const body = resolveBody({ body: args.body, bodyFile: args["body-file"] }, json)
    const area = resolveArea(args.area, json)
    const context = resolveContext(
      { context: args.context, contextFile: args["context-file"] },
      json,
    )

    const input: SubmitFeedbackInput = { body }
    if (area !== undefined) input.area = area
    if (context !== undefined) input.context = context

    return runTool(client, publicToolContracts.outlit_submit_feedback.toolName, input, json, {
      spinnerMessage: "Submitting feedback...",
    })
  },
})
