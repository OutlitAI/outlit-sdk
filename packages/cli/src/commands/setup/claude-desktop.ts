import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { getClaudeDesktopConfigPath, requireCredential } from "../../lib/config"
import { runMcpFileSetup } from "../../lib/setup"

const getConfig = (key: string) => {
  const configPath = getClaudeDesktopConfigPath()
  return {
    agentId: "claude-desktop" as const,
    configPath,
    serversKey: "mcpServers",
    label: "Claude Desktop config",
    successMessage: `Outlit added to Claude Desktop. Restart Claude Desktop to apply.\n  Config: ${configPath}`,
    mcpConfig: { command: "outlit", args: ["mcp", "serve"], env: { OUTLIT_API_KEY: key } },
  }
}

export function configureSafe(key: string, json: boolean): boolean {
  return runMcpFileSetup(key, json, getConfig(key), false).success
}

export default defineCommand({
  meta: {
    name: "claude-desktop",
    description: "Add Outlit MCP server to Claude Desktop config.",
  },
  args: { ...authArgs, ...outputArgs },
  run({ args }) {
    const json = !!args.json
    const { key } = requireCredential(args["api-key"], json)
    runMcpFileSetup(key, json, getConfig(key))
  },
})
