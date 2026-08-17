import { publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { requiredTrimmedString } from "../../lib/platform-input"

export default defineCommand({
  meta: {
    name: "archive",
    description: [
      "Archive a Value Feature using its opaque id and current revision.",
      "Core rejects stale revisions and prevents archiving the final active feature.",
      "Self-service restore is not available in the MVP; retained historical usage is not deleted.",
      "",
      "Example:",
      "  outlit value-features archive value_feature_v1_0123456789abcdef0123456789abcdef --revision value_feature_revision_v1_fedcba9876543210fedcba9876543210 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    id: { type: "positional", description: "Opaque Value Feature id", required: true },
    revision: { type: "string", description: "Current opaque Value Feature revision" },
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      publicToolContracts.outlit_archive_value_feature.toolName,
      {
        id: requiredTrimmedString(args.id, "<id>", json),
        revision: requiredTrimmedString(args.revision, "--revision", json),
      },
      json,
      { spinnerMessage: "Archiving Value Feature..." },
    )
  },
})
