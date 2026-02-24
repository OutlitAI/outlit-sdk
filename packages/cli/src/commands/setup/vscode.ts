import { join } from "node:path"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { requireCredential } from "../../lib/config"
import { runMcpFileSetup } from "../../lib/setup"

const getConfig = () => ({
  agentId: "vscode" as const,
  configPath: join(process.cwd(), ".vscode", "mcp.json"),
  serversKey: "servers",
  label: ".vscode/mcp.json",
  successMessage: "Outlit MCP config written to .vscode/mcp.json. Restart VS Code to apply.",
})

export function configureSafe(key: string, json: boolean): boolean {
  return runMcpFileSetup(key, json, getConfig(), false).success
}

export default defineCommand({
  meta: {
    name: "vscode",
    description: "Write Outlit MCP config to .vscode/mcp.json in the current directory.",
  },
  args: { ...authArgs, ...outputArgs },
  run({ args }) {
    const json = !!args.json
    const { key } = requireCredential(args["api-key"], json)
    runMcpFileSetup(key, json, getConfig())
  },
})
