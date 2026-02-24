import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { requireCredential } from "../../lib/config"
import { outputError } from "../../lib/output"
import { runMcpCliSetup } from "../../lib/setup"

const getConfig = () => ({
  cliName: "gemini",
  agentId: "gemini" as const,
  notFoundMessage: "gemini CLI not found. Install from https://github.com/google-gemini/gemini-cli",
  notFoundCode: "gemini_not_found",
  successMessage: "Outlit added to Gemini CLI. Restart Gemini CLI to apply.",
})

export function configureSafe(key: string, json: boolean): boolean {
  return runMcpCliSetup(key, json, getConfig(), false).success
}

export default defineCommand({
  meta: {
    name: "gemini",
    description: "Register Outlit MCP server with Gemini CLI via `gemini mcp add`.",
  },
  args: { ...authArgs, ...outputArgs },
  run({ args }) {
    const json = !!args.json
    const { key } = requireCredential(args["api-key"], json)

    runMcpCliSetup(key, json, {
      ...getConfig(),
      extraErrorHandler(err, j) {
        const msg = err instanceof Error ? err.message.toLowerCase() : ""
        if (msg.includes("mcp") && msg.includes("not")) {
          outputError(
            {
              message:
                "Your Gemini CLI version does not support 'mcp add'. Run 'gemini update' or reinstall.",
              code: "gemini_mcp_unsupported",
            },
            j,
          )
        }
      },
    })
  },
})
