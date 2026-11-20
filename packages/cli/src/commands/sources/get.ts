import { publicToolContracts, sourceTypes as toolSourceTypes } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { PAGE_SIZE } from "../../args/pagination"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { toWireSourceTypes } from "../../lib/source-types"

/** A memory entry a fact cites; only the exact lookup opens it. */
const EXTRACTED = "extracted"
const sourceTypeDescription = [...toolSourceTypes, EXTRACTED].join(", ")

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact source by source type and id: the `source {type, id}` another command returned.",
      "Returns the same normalized source envelope as `sources list`, with its content a page of segments at a time.",
      "",
      "Examples:",
      "  outlit sources get call call_123",
      "  outlit sources get slack thread_123 --limit 50",
      "  outlit sources get opportunity opp_123",
      "  outlit sources get support_ticket ticket_456 --attachments --json",
      "  outlit sources get email email_123 --attachment <key> --page 2 --json",
      "",
      `Source types: ${sourceTypeDescription}`,
      "Use `outlit sources list` when you need deterministic enumeration rather than exact lookup.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    type: {
      type: "positional",
      description: `Source type (${sourceTypeDescription})`,
      required: true,
    },
    id: {
      type: "positional",
      description: "Exact source id",
      required: true,
    },
    attachments: {
      type: "boolean",
      description:
        "List this email or ticket’s published attachments and readable page references.",
    },
    attachment: {
      type: "string",
      description: "Open the file named by a returned attachmentPage.key.",
    },
    revision: {
      type: "string",
      description: "Pin a cited page to the returned attachmentPage.revision.",
    },
    page: { type: "string", description: "Page number within the attachment (default 1)." },
    limit: {
      type: "string",
      description: publicToolContracts.outlit_get_source.inputSchema.properties.limit.description,
    },
    cursor: {
      type: "string",
      description: publicToolContracts.outlit_get_source.inputSchema.properties.cursor.description,
    },
  },
  async run({ args }) {
    const json = !!args.json

    // Any case is accepted, and the previously published aliases (CRM, STRIPE_INVOICE).
    const requested = args.type.trim()
    const sourceType =
      requested.toLowerCase() === EXTRACTED
        ? EXTRACTED
        : (() => {
            const result = toWireSourceTypes([requested], { sourceTools: true })
            return result.ok ? result.types[0] : undefined
          })()
    if (!sourceType) {
      return outputError(
        {
          message: `<type> must be one of ${sourceTypeDescription}`,
          code: "invalid_input",
        },
        json,
      )
    }

    if (
      args.revision !== undefined &&
      (!args.attachment || !/^[a-f0-9]{64}:[A-Za-z0-9.+_-]{1,64}$/.test(args.revision))
    ) {
      return outputError(
        {
          message: "Use --revision with --attachment and the revision returned by the source tool.",
          code: "invalid_input",
        },
        json,
      )
    }
    const attachment = args.attachment
    const page = args.page === undefined ? 1 : Number(args.page)
    if (
      (attachment !== undefined || args.attachments || args.page !== undefined) &&
      !["email", "support_ticket"].includes(sourceType)
    ) {
      return outputError(
        {
          message: "Attachment flags require an email or support_ticket source.",
          code: "invalid_input",
        },
        json,
      )
    }
    if (
      (args.page !== undefined && !attachment) ||
      (attachment !== undefined &&
        (!/^[a-f0-9]{32}$/.test(attachment) ||
          !Number.isSafeInteger(page) ||
          page < 1 ||
          args.attachments))
    ) {
      return outputError(
        {
          message:
            "Use --attachments to list files, or --attachment <key> with an optional positive --page.",
          code: "invalid_input",
        },
        json,
      )
    }

    const limit = args.limit ? Number(args.limit) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > PAGE_SIZE.max)) {
      return outputError(
        {
          message: `--limit must be an integer between 1 and ${PAGE_SIZE.max} (got: ${args.limit})`,
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_get_source.toolName,
      {
        source: {
          type: sourceType,
          id: args.id.trim(),
          ...(attachment
            ? {
                attachmentPage: {
                  key: attachment,
                  page,
                  ...(args.revision ? { revision: args.revision } : {}),
                },
              }
            : {}),
        },
        ...(args.attachments ? { includeAttachments: true } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(args.cursor ? { cursor: args.cursor } : {}),
      },
      json,
    )
  },
})
