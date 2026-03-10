import * as p from "@clack/prompts"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"
import { resolveProviderOrExit } from "../../lib/providers"
import { createSpinner } from "../../lib/spinner"
import { isInteractive } from "../../lib/tty"

export default defineCommand({
  meta: {
    name: "remove",
    description: [
      "Disconnect an integration and remove all synced data.",
      "",
      "This permanently deletes all data that was synced from the integration",
      "(e.g., opportunities, contacts, messages). The action cannot be undone.",
      "",
      "Examples:",
      "  outlit integrations remove salesforce",
      "  outlit integrations remove slack --yes     # skip confirmation prompt",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    provider: {
      type: "positional",
      description: "Integration provider to disconnect",
      required: true,
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation prompt (required in non-interactive mode).",
    },
  },
  async run({ args }) {
    const json = !!args.json

    const { provider, cliName } = resolveProviderOrExit(args.provider, json)

    // Auth check before confirmation — don't ask user to confirm if they can't authenticate
    const client = await getClientOrExit(args["api-key"], json)

    // Require confirmation
    if (!args.yes) {
      if (!isInteractive() || json) {
        return outputError(
          {
            message: `Disconnecting ${provider.name} requires confirmation. Use --yes to confirm in non-interactive or JSON mode.`,
            code: "confirmation_required",
          },
          json,
        )
      }

      p.log.warn(
        `This will disconnect ${provider.name} and delete all synced data.\nThis action cannot be undone.`,
      )

      const confirmed = await p.confirm({ message: `Disconnect ${provider.name}?` })
      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("Cancelled.")
        return
      }
    }
    const spinner = createSpinner(`Disconnecting ${provider.name}...`)

    try {
      const result = (await client.callTool("outlit_disconnect_integration", {
        provider: provider.id,
      })) as { success: boolean; message?: string }

      if (result.success) {
        spinner.stop(`${provider.name} disconnected. All synced data has been removed.`)
        if (isJsonMode(json)) {
          return outputResult({ success: true, provider: cliName })
        }
      } else {
        spinner.fail(`Failed to disconnect ${provider.name}`)
        return outputError(
          {
            message: result.message ?? `Failed to disconnect ${provider.name}`,
            code: "disconnect_failed",
          },
          json,
        )
      }
    } catch (err) {
      spinner.fail(`Failed to disconnect ${provider.name}`)
      return outputError(
        { message: errorMessage(err, "Disconnect request failed"), code: "api_error" },
        json,
      )
    }
  },
})
