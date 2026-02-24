import { homedir } from "node:os"
import { join } from "node:path"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { requireCredential } from "../../lib/config"
import { runMcpFileSetup } from "../../lib/setup"

const getConfig = () => ({
  agentId: "cursor" as const,
  configPath: join(homedir(), ".cursor", "mcp.json"),
  serversKey: "mcpServers",
  label: "cursor mcp.json",
  successMessage:
    "Outlit added to Cursor MCP config. Restart Cursor to apply.\n  Config: ~/.cursor/mcp.json",
})

export function configureSafe(key: string, json: boolean): boolean {
  return runMcpFileSetup(key, json, getConfig(), false).success
}

export default defineCommand({
  meta: {
    name: "cursor",
    description: "Add Outlit MCP server to ~/.cursor/mcp.json.",
  },
  args: { ...authArgs, ...outputArgs },
  run({ args }) {
    const json = !!args.json
    const { key } = requireCredential(args["api-key"], json)
    runMcpFileSetup(key, json, getConfig())
  },
})
