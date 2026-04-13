import { customerSourceTypes, customerToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact source by source type and source id.",
      "",
      "Examples:",
      "  outlit sources get --source-type CALL --source-id call_123",
      "  outlit sources get --source-type SUPPORT_TICKET --source-id ticket_456 --json",
      "",
      `Source types: ${customerSourceTypes.join(", ")}`,
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "source-type": {
      type: "string",
      description: "Canonical source type",
      required: true,
    },
    "source-id": {
      type: "string",
      description: "Exact source id",
      required: true,
    },
  },
  async run({ args }) {
    const json = !!args.json

    if (
      !customerSourceTypes.includes(args["source-type"] as (typeof customerSourceTypes)[number])
    ) {
      return outputError(
        {
          message: `--source-type must be one of ${customerSourceTypes.join(", ")}`,
          code: "invalid_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      customerToolContracts.outlit_get_source.toolName,
      {
        sourceType: args["source-type"],
        sourceId: args["source-id"],
      },
      json,
    )
  },
})
