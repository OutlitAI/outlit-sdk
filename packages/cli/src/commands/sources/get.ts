import {
  customerSourceTypeAliases,
  customerSourceTypeInputs,
  customerSourceTypes,
  customerToolContracts,
  normalizeCustomerSourceType,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

const sourceTypeDescription = `${customerSourceTypes.join(", ")} (aliases: ${customerSourceTypeAliases.join(", ")})`

export default defineCommand({
  meta: {
    name: "get",
    description: [
      "Get one exact source by source type and source id.",
      "",
      "Examples:",
      "  outlit sources get --source-type CALL --source-id call_123",
      "  outlit sources get --source-type OPPORTUNITY --source-id opp_123",
      "  outlit sources get --source-type SUPPORT_TICKET --source-id ticket_456 --json",
      "",
      `Source types: ${sourceTypeDescription}`,
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "source-type": {
      type: "string",
      description: `Source type (${sourceTypeDescription})`,
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

    const sourceType = normalizeCustomerSourceType(args["source-type"])
    if (!sourceType) {
      return outputError(
        {
          message: `--source-type must be one of ${customerSourceTypeInputs.join(", ")}`,
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
        sourceType,
        sourceId: args["source-id"],
      },
      json,
    )
  },
})
