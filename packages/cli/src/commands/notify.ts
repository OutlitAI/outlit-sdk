import { readFileSync } from "node:fs"
import {
  customerToolContracts,
  notificationProviderValues,
  notificationSeverityValues,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { getClientOrExit, runTool } from "../lib/api"
import { errorMessage, outputError } from "../lib/output"

type NotificationSeverity = (typeof notificationSeverityValues)[number]
type NotificationProvider = (typeof notificationProviderValues)[number]
type NotificationDestination = {
  provider: NotificationProvider
  channelId?: string
}

const MAX_DESTINATION_COUNT = 10
const MAX_DESTINATION_CHANNEL_ID_LENGTH = 240

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function validateTrimmedText(
  value: string | undefined,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null
  }

  return trimmed
}

function normalizeSeverity(severity: string): NotificationSeverity | null {
  const normalized = severity.trim().toLowerCase()
  return notificationSeverityValues.includes(normalized as NotificationSeverity)
    ? (normalized as NotificationSeverity)
    : null
}

function payloadSizeIsValid(payload: unknown): boolean {
  const serialized = JSON.stringify(payload)
  return typeof serialized === "string" && serialized.length <= 100000
}

function parseDestinations(raw: string | undefined): NotificationDestination[] | null | undefined {
  if (raw === undefined) {
    return undefined
  }

  const destinations = raw.split(",").map((entry) => entry.trim())
  if (
    destinations.length > MAX_DESTINATION_COUNT ||
    destinations.some((entry) => entry.length === 0)
  ) {
    return null
  }

  const parsed: NotificationDestination[] = []
  for (const destination of destinations) {
    const [providerInput, ...channelParts] = destination.split(":")
    const provider = providerInput?.trim().toLowerCase()
    const channelId = channelParts.join(":").trim()

    if (!notificationProviderValues.includes(provider as NotificationProvider)) {
      return null
    }

    if (channelId.length > MAX_DESTINATION_CHANNEL_ID_LENGTH) {
      return null
    }

    parsed.push({
      provider: provider as NotificationProvider,
      ...(channelId.length > 0 ? { channelId } : {}),
    })
  }

  return parsed
}

export default defineCommand({
  meta: {
    name: "notify",
    description: [
      "Send a notification through Outlit to the organization's configured notifier.",
      "",
      "Use --markdown or --markdown-file for the human-readable body; Outlit renders it for the destination platform.",
      "Add a JSON or raw payload when useful for structured context. When --destination is omitted, Outlit uses the default notifier.",
      "",
      "Examples:",
      "  outlit notify --title 'Risk found' --markdown '**Risk found**\\n\\n- Customer: acme.com'",
      "  outlit notify --title 'Risk found' '{\"customer\":\"acme.com\"}'",
      "  outlit notify --title 'Risk found' --payload-file ./payload.json",
      "  outlit notify --title 'Escalation' --markdown '**Check this account**' --destination slack:C123",
      "  outlit notify --title 'Escalation' --severity HIGH --message 'Check this account' '{\"customer\":\"acme.com\"}'",
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
    markdown: {
      type: "string",
      description: "Markdown body rendered for the destination platform.",
    },
    "markdown-file": {
      type: "string",
      description: "Path to a markdown file to render for the destination platform.",
    },
    message: {
      type: "string",
      description: "Optional summary message",
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
    destination: {
      type: "string",
      description:
        "Optional comma-separated destinations in provider[:channelId] form. Supported provider: slack",
    },
  },
  async run({ args }) {
    const json = !!args.json

    const title = args.title?.trim()
    if (!title) {
      return outputError({ message: "Provide --title", code: "missing_input" }, json)
    }
    if (title.length > 160) {
      return outputError(
        {
          message: "--title must be 160 characters or fewer after trimming",
          code: "invalid_input",
        },
        json,
      )
    }

    let markdownInput = args.markdown
    if (args["markdown-file"]) {
      try {
        markdownInput = readFileSync(args["markdown-file"], "utf-8")
      } catch (err) {
        return outputError(
          {
            message: `Cannot read markdown file: ${errorMessage(err, "unknown error")}`,
            code: "file_error",
          },
          json,
        )
      }
    }

    const markdown = validateTrimmedText(markdownInput, 100000)
    if (markdown === null) {
      return outputError(
        {
          message: "--markdown must be between 1 and 100000 characters after trimming",
          code: "invalid_input",
        },
        json,
      )
    }

    const message = validateTrimmedText(args.message, 1200)
    if (message === null) {
      return outputError(
        {
          message: "--message must be between 1 and 1200 characters after trimming",
          code: "invalid_input",
        },
        json,
      )
    }

    const source = validateTrimmedText(args.source, 120)
    if (source === null) {
      return outputError(
        {
          message: "--source must be between 1 and 120 characters after trimming",
          code: "invalid_input",
        },
        json,
      )
    }

    const subject = validateTrimmedText(args.subject, 240)
    if (subject === null) {
      return outputError(
        {
          message: "--subject must be between 1 and 240 characters after trimming",
          code: "invalid_input",
        },
        json,
      )
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

    const destinations = parseDestinations(args.destination)
    if (destinations === null) {
      return outputError(
        {
          message: `--destination must use provider[:channelId] with provider one of: ${notificationProviderValues.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
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
    }

    if (!payloadInput && markdown === undefined) {
      return outputError(
        {
          message: "Provide --markdown, --markdown-file, a payload, or --payload-file",
          code: "missing_input",
        },
        json,
      )
    }

    const payload = payloadInput === undefined ? undefined : parsePayload(payloadInput)
    if (payload !== undefined && !payloadSizeIsValid(payload)) {
      return outputError(
        {
          message: "Payload must serialize to 100000 characters or fewer",
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    const params: Record<string, unknown> = {
      title,
    }

    if (markdown !== undefined) {
      params.markdown = markdown
    }

    if (payload !== undefined) {
      params.payload = payload
    }

    if (message !== undefined) {
      params.message = message
    }

    if (severity) {
      params.severity = severity
    }

    if (source !== undefined) {
      params.source = source
    }

    if (subject !== undefined) {
      params.subject = subject
    }

    if (destinations !== undefined) {
      params.destinations = destinations
    }

    return runTool(client, customerToolContracts.outlit_send_notification.toolName, params, json)
  },
})
