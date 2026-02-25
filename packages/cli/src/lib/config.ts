import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import pkg from "../../package.json"
import { errorMessage, outputError } from "./output"
import { isUnicodeSupported } from "./tty"

/** CLI version — read from package.json, inlined at build time by Bun's bundler. */
export const CLI_VERSION: string = pkg.version

/** The hosted Outlit MCP server endpoint. Used by setup commands for AI agent configuration. */
export const DEFAULT_MCP_URL = "https://mcp.outlit.ai/mcp"

/** The Outlit Platform API base URL. Used by the CLI client for direct REST calls. */
export const DEFAULT_API_URL = "https://app.outlit.ai"

/** Outlit dashboard URL for API key management. */
export const OUTLIT_DASHBOARD_URL = "https://app.outlit.ai/workspace-profile"

/** ANSI green checkmark for interactive terminal output. Falls back to ASCII on Windows. */
export const TICK = `\x1b[32m${isUnicodeSupported ? String.fromCodePoint(0x2713) : String.fromCodePoint(0x221a)}\x1b[0m`

/** Checks if an error is a Node.js ENOENT (file/command not found). */
export function isEnoentError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT"
}

/** Splits a comma-separated string into a trimmed array. */
export function splitCsv(value: string): string[] {
  return value.split(",").map((s) => s.trim())
}

/**
 * Returns the platform-appropriate path to Claude Desktop's config file.
 *
 * macOS:    ~/Library/Application Support/Claude/claude_desktop_config.json
 * Windows:  %APPDATA%/Claude/claude_desktop_config.json
 * Linux:    ~/.config/Claude/claude_desktop_config.json
 */
export function getClaudeDesktopConfigPath(): string {
  const home = homedir()
  switch (process.platform) {
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json",
      )
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json")
  }
}

export interface CredentialResult {
  /** The raw API key string (ok_...) */
  key: string
  /** Where the key was found — useful for diagnostics (outlit doctor, auth status) */
  source: "flag" | "env" | "config"
}

/**
 * Returns the platform-appropriate config directory for Outlit CLI.
 *
 * macOS/Linux: ~/.config/outlit/ (respects XDG_CONFIG_HOME)
 * Windows:     %APPDATA%\outlit\
 *
 * Convention: CLI tools use ~/.config/, not ~/Library/Application Support/.
 * That convention is for GUI apps (macOS) or ~/.local/share/ (Linux).
 */
export function getConfigDir(): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "outlit")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "outlit")
}

/**
 * Resolves the API key from the priority chain:
 * 1. --api-key flag (flagValue argument)
 * 2. OUTLIT_API_KEY environment variable
 * 3. ~/.config/outlit/credentials.json (written by `outlit auth login`)
 *
 * Returns null if no key is found anywhere.
 * Never throws — corrupted config files are silently ignored.
 */
export function resolveApiKey(flagValue?: string): CredentialResult | null {
  if (flagValue) return { key: flagValue, source: "flag" }

  const envKey = process.env.OUTLIT_API_KEY
  if (envKey) return { key: envKey, source: "env" }

  const credPath = join(getConfigDir(), "credentials.json")
  if (existsSync(credPath)) {
    try {
      const raw = readFileSync(credPath, "utf-8")
      const config = JSON.parse(raw) as { apiKey?: string }
      if (config.apiKey) return { key: config.apiKey, source: "config" }
    } catch {
      // Corrupted file — treat as absent. User can re-run `outlit auth login`.
    }
  }

  return null
}

/**
 * Returns a masked version of an API key for display.
 * ok_abc...1234 — never shows the full key to the user.
 */
export function maskKey(key: string): string {
  if (key.length <= 9) return key
  return `${key.slice(0, 5)}...${key.slice(-4)}`
}

/**
 * Reads and parses a JSON config file, returning an empty object on any error.
 *
 * Used by setup commands that merge into existing MCP config files.
 * Never throws — a missing or corrupted file is treated as an empty config.
 */
export function readJsonConfig(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {}
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Resolves a credential or exits with not_authenticated.
 *
 * Replaces the repeated resolveApiKey + outputError pattern in setup commands.
 */
export function requireCredential(flagApiKey: string | undefined, json: boolean): CredentialResult {
  const credential = resolveApiKey(flagApiKey)
  if (!credential) {
    return outputError(
      {
        message: "Not authenticated. Run `outlit auth login` or pass --api-key.",
        code: "not_authenticated",
      },
      json,
    )
  }
  return credential
}

/**
 * Creates parent directories and writes content to a file.
 * On failure, calls outputError with write_error code and the given label.
 * Returns true on success (callers can continue); never returns on failure.
 */
export function writeConfigFile(
  filePath: string,
  content: string,
  opts: { json: boolean; label: string },
): true {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
    return true
  } catch (err) {
    return outputError(
      { message: errorMessage(err, `Failed to write ${opts.label}`), code: "write_error" },
      opts.json,
    )
  }
}

/**
 * Merges an Outlit MCP server entry into an existing JSON config file.
 *
 * Used by cursor, claude-desktop, and vscode setup commands.
 * Reads the file (or starts from {}), spreads the existing servers,
 * adds/overwrites the "outlit" key, and writes back.
 */
export function mergeOutlitMcpConfig(
  configPath: string,
  serversKey: string,
  outlitConfig: Record<string, unknown>,
  opts: { json: boolean; label: string },
): void {
  const existing = readJsonConfig(configPath)
  const existingServers = (existing[serversKey] as Record<string, unknown> | undefined) ?? {}
  const merged = {
    ...existing,
    [serversKey]: { ...existingServers, outlit: outlitConfig },
  }
  writeConfigFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, opts)
}

/**
 * Writes the API key to ~/.config/outlit/credentials.json with 0600 permissions.
 *
 * The 0600 mode is set atomically at write time (not via a separate chmod call),
 * which avoids a race window where another process could read a world-readable file.
 *
 * Returns the absolute path to the credentials file.
 */
export function storeApiKey(apiKey: string): string {
  const configDir = getConfigDir()
  mkdirSync(configDir, { recursive: true, mode: 0o700 })
  const credPath = join(configDir, "credentials.json")
  writeFileSync(credPath, JSON.stringify({ apiKey }, null, 2), { mode: 0o600 })
  return credPath
}
