import { execFileSync } from "node:child_process"
import { DEFAULT_MCP_URL, TICK, isEnoentError, mergeOutlitMcpConfig } from "./config"
import { errorMessage, isJsonMode, outputError, outputResult } from "./output"

/**
 * Registers an MCP server with a CLI-based agent (claude, gemini).
 *
 * Runs: `<cliName> mcp add --transport http outlit <MCP_URL> --header "Authorization: Bearer <key>"`
 *
 * When `exitOnError` is false, returns { success, error? } instead of calling process.exit.
 * This allows batch setup (outlit setup) to continue on individual failures.
 */
export function runMcpCliSetup(
  key: string,
  json: boolean,
  opts: {
    cliName: string
    agentId: string
    notFoundMessage: string
    notFoundCode: string
    successMessage: string
    /** Optional extra error handler before the generic fallback (e.g. gemini version check). */
    extraErrorHandler?: (err: unknown, json: boolean) => void
  },
  exitOnError = true,
): { success: boolean; error?: string } {
  try {
    execFileSync(
      opts.cliName,
      [
        "mcp",
        "add",
        "--transport",
        "http",
        "outlit",
        DEFAULT_MCP_URL,
        "--header",
        `Authorization: Bearer ${key}`,
      ],
      { stdio: !isJsonMode(json) ? "inherit" : "ignore" },
    )
  } catch (err) {
    if (exitOnError) {
      if (isEnoentError(err)) {
        return outputError({ message: opts.notFoundMessage, code: opts.notFoundCode }, json)
      }
      opts.extraErrorHandler?.(err, json)
      return outputError(
        { message: errorMessage(err, `${opts.cliName} mcp add failed`), code: "exec_error" },
        json,
      )
    }
    return { success: false, error: errorMessage(err, `${opts.cliName} mcp add failed`) }
  }

  if (exitOnError) {
    if (isJsonMode(json)) {
      outputResult({ success: true, agent: opts.agentId })
      return { success: true }
    }
    console.log(`${TICK} ${opts.successMessage}`)
  }

  return { success: true }
}

/**
 * Adds an MCP server to a file-based agent config (cursor, vscode, claude-desktop).
 *
 * When `exitOnError` is false, returns { success, error? } instead of calling process.exit.
 */
export function runMcpFileSetup(
  key: string,
  json: boolean,
  opts: {
    agentId: string
    configPath: string
    serversKey: string
    label: string
    successMessage: string
    /** Override the MCP config payload (e.g. claude-desktop uses command-based config). */
    mcpConfig?: Record<string, unknown>
  },
  exitOnError = true,
): { success: boolean; error?: string } {
  const mcpConfig = opts.mcpConfig ?? {
    url: DEFAULT_MCP_URL,
    headers: { Authorization: `Bearer ${key}` },
  }

  try {
    mergeOutlitMcpConfig(opts.configPath, opts.serversKey, mcpConfig, { json, label: opts.label })
  } catch (err) {
    if (!exitOnError) {
      return { success: false, error: errorMessage(err, `Failed to write ${opts.label}`) }
    }
    throw err
  }

  if (exitOnError) {
    if (isJsonMode(json)) {
      outputResult({ success: true, path: opts.configPath, agent: opts.agentId })
      return { success: true }
    }
    console.log(`${TICK} ${opts.successMessage}`)
  }

  return { success: true }
}
