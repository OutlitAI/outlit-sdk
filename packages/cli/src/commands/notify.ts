import { readFileSync } from "node:fs"
import { customerToolContracts, notificationSeverityValues } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { errorMessage, outputError } from "../lib/output"

type NotificationSeverity = (typeof notificationSeverityValues)[number]

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function normalizeSeverity(severity: string): NotificationSeverity | null {
  const normalized = severity.trim().toLowerCase()
  return notificationSeverityValues.includes(normalized as NotificationSeverity)
    ? (normalized as NotificationSeverity)
    : null
}

export default defineCommand({
  meta: {
    name: "notify",
    description: [
      "Send a Slack notification through Outlit.",
      "",
      "Provide the payload as a positional argument or via --payload-file.",
      "When both are provided, --payload-file takes precedence.",
      "",
      "Examples:",
      "  outlit notify --title 'Risk found' '{\"customer\":\"acme.com\"}'",
      "  outlit notify --title 'Risk found' --payload-file ./payload.json",
      "  outlit notify --title 'Escalation' --severity HIGH --message 'Check this account'",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    title: {
      type: "string",
      description: "Notification title",
      required: false,
    },
    payload: {
      type: "positional",
      description: "Notification payload as JSON or raw string",
      required: false,
    },
    "payload-file": {
      type: "string",
      description: "Path to a payload file to read (takes precedence over positional payload)",
    },
    message: {
      type: "string",
      description: "Optional Slack message",
    },
    severity: {
      type: "string",
      description: `Optional notification severity (${notificationSeverityValues.join(", ")})`,
    },
    source: {
      type: "string",
      description: "Optional source label",
    },
    subject: {
      type: "string",
      description: "Optional subject line",
    },
  },
  async run({ args }) {
    const json = !!args.json

    if (!args.title?.trim()) {
      return outputError({ message: "Provide --title", code: "missing_input" }, json)
    }

    let severity: NotificationSeverity | undefined
    if (args.severity) {
      const normalized = normalizeSeverity(args.severity)
      if (!normalized) {
        return outputError(
          {
            message: `--severity must be one of: ${notificationSeverityValues.join(", ")}`,
            code: "invalid_input",
          },
          json,
        )
      }

      severity = normalized
    }

    let payloadInput: string | undefined
    if (args["payload-file"]) {
      try {
        payloadInput = readFileSync(args["payload-file"], "utf-8")
      } catch (err) {
        return outputError(
          {
            message: `Cannot read file: ${errorMessage(err, "unknown error")}`,
            code: "file_error",
          },
          json,
        )
      }
    } else if (typeof args.payload === "string" && args.payload.trim().length > 0) {
      payloadInput = args.payload
    } else {
      return outputError(
        { message: "Provide a payload or --payload-file", code: "missing_input" },
        json,
      )
    }

    const payload = parsePayload(payloadInput)
    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {
      title: args.title,
      payload,
    }

    if (args.message !== undefined) {
      params.message = args.message
    }

    if (severity) {
      params.severity = severity
    }

    if (args.source !== undefined) {
      params.source = args.source
    }

    if (args.subject !== undefined) {
      params.subject = args.subject
    }

    return runTool(client, customerToolContracts.outlit_send_notification.toolName, params, json)
  },
})
