import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import { runConfirmedWrite, yesArg } from "../../lib/confirm"
import { requiredTrimmedString } from "../../lib/platform-input"
import { newRequestId } from "../../lib/request-id"

type FeatureArchivePreview = {
  archived: boolean
  preview?: { token: string }
  impact?: { feature: { name: string }; activeFeaturesRemaining: number }
}

function readPending(result: unknown) {
  const data = result as FeatureArchivePreview
  if (data.archived || !data.preview) return null
  const remaining = data.impact?.activeFeaturesRemaining
  return {
    token: data.preview.token,
    lines: [
      `Archive the Feature ${data.impact?.feature.name ?? "you named"}.`,
      ...(remaining === undefined ? [] : [`${remaining} active Features remain.`]),
    ],
  }
}

export default defineCommand({
  meta: {
    name: "archive",
    description: [
      "Archive a Feature using its opaque id and current revision.",
      "Core rejects stale revisions and prevents archiving the final active feature.",
      "Self-service restore is not available in the MVP; retained historical usage is not deleted.",
      "",
      "Outlit first shows what archiving would change. In a terminal you are asked to confirm;",
      "otherwise pass --yes, or the command prints the preview, archives nothing, and exits 1.",
      "",
      "Example:",
      "  outlit features archive value_feature_v1_0123456789abcdef0123456789abcdef --revision value_feature_revision_v1_fedcba9876543210fedcba9876543210 --yes --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    ...yesArg,
    id: { type: "positional", description: "Opaque Feature id", required: true },
    revision: { type: "string", description: "Current opaque Feature revision" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)
    const id = requiredTrimmedString(args.id, "<id>", json)
    const revision = requiredTrimmedString(args.revision, "--revision", json)

    return runConfirmedWrite(client, "outlit_archive_feature", {
      input: { id, revision, requestId: newRequestId() },
      json,
      yes: args.yes === true,
      spinnerMessage: "Archiving Feature...",
      pending: readPending,
      confirmed: (previewToken) => ({
        id,
        revision,
        mode: "execute",
        previewToken,
        requestId: newRequestId(),
      }),
      question: "Archive this Feature?",
      unchanged: "Nothing was archived",
    })
  },
})
