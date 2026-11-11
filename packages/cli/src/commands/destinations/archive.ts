import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { newRequestId } from "../../lib/request-id"
import { parseWriteMode, writeModeArgs } from "../../lib/write-mode"

type ArchivePreview = {
  archived: boolean
  preview?: { token: string }
  impact?: { destination: { name: string }; routes: number }
}

function readPending(result: unknown) {
  const data = result as ArchivePreview
  if (data.archived || !data.preview) return null
  const name = data.impact?.destination.name ?? "this destination"
  const routes = data.impact?.routes ?? 0
  return {
    token: data.preview.token,
    lines: [
      `Archive ${name}.`,
      routes === 0
        ? "No automation routes deliver to it."
        : `${routes} automation route${routes === 1 ? "" : "s"} deliver${routes === 1 ? "s" : ""} to it.`,
    ],
  }
}

export default defineCommand({
  meta: {
    name: "archive",
    description: [
      "Archive a configured Outlit automation destination by id.",
      "",
      "Outlit first shows what archiving would affect. In a terminal you are asked to confirm;",
      "otherwise pass --yes, or the command prints the preview, archives nothing, and exits 1.",
      "",
      "Examples:",
      "  outlit destinations archive 10000000-0000-4000-8000-000000000003",
      "  outlit destinations archive 10000000-0000-4000-8000-000000000003 --yes --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...yesArg,
    ...writeModeArgs,
    id: {
      type: "positional",
      description: "Destination ID to archive",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const id = args.id
    const write = parseWriteMode(args, json)

    if (write.explicit) {
      return runTool(
        client,
        "outlit_archive_destination",
        { id, ...write.explicit, requestId: write.requestId },
        json,
        { spinnerMessage: "Archiving destination..." },
      )
    }

    return runConfirmedWrite(client, "outlit_archive_destination", {
      input: { id, requestId: write.requestId },
      json,
      yes: args.yes === true,
      spinnerMessage: "Archiving destination...",
      pending: readPending,
      confirmed: (previewToken) => ({
        id,
        mode: "execute",
        previewToken,
        requestId: newRequestId(),
      }),
      question: "Archive this destination?",
      unchanged: "Nothing was archived",
    })
  },
})
