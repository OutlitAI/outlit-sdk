import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { requireCredential } from "../../lib/config"
import { runMcpCliSetup } from "../../lib/setup"

const getConfig = () => ({
  cliName: "claude",
  agentId: "claude-code" as const,
  notFoundMessage: "claude CLI not found. Install from https://claude.ai/code",
  notFoundCode: "claude_not_found",
  successMessage: "Outlit added to Claude Code. Restart Claude Code to apply.",
})

export function configureSafe(key: string, json: boolean): boolean {
  return runMcpCliSetup(key, json, getConfig(), false).success
}

export default defineCommand({
  meta: {
    name: "claude-code",
    description: "Register Outlit MCP server with Claude Code via `claude mcp add`.",
  },
  args: { ...authArgs, ...outputArgs },
  run({ args }) {
    const json = !!args.json
    const { key } = requireCredential(args["api-key"], json)
    runMcpCliSetup(key, json, getConfig())
  },
})
