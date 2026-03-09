import { execFileSync } from "node:child_process"

/**
 * Detects whether the terminal can render Unicode characters.
 *
 * Returns false on Windows unless running inside Windows Terminal or VS Code,
 * which are known to support Unicode. Matches the check used by yocto-spinner
 * and is-unicode-supported.
 */
export const isUnicodeSupported: boolean =
  process.platform !== "win32" ||
  Boolean(process.env.WT_SESSION) ||
  process.env.TERM_PROGRAM === "vscode"

/** Returns the platform-specific command for opening URLs in a browser. */
function openBrowserCmd(): string {
  return process.platform === "darwin" ? "open" : "xdg-open"
}

/**
 * Opens a URL in the user's default browser.
 * Returns true if the command succeeded, false otherwise.
 * Callers should print the URL as a fallback when this returns false.
 */
export function openBrowser(url: string): boolean {
  try {
    if (process.platform === "win32") {
      execFileSync("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], { stdio: "ignore" })
    } else {
      execFileSync(openBrowserCmd(), [url], { stdio: "ignore" })
    }
    return true
  } catch {
    return false
  }
}

/**
 * Detects whether the CLI is running in an interactive terminal.
 *
 * Returns false (non-interactive) when:
 * - stdin or stdout is piped (e.g. `outlit ... | jq` or agent subprocess)
 * - CI=true or CI=1 (generic CI signal)
 * - GITHUB_ACTIONS is set
 * - TERM=dumb (terminal cannot render ANSI)
 *
 * When non-interactive, all commands default to JSON output without --json.
 * This is what makes the CLI work seamlessly in AI agent contexts (Claude Code,
 * Cursor, OpenClaw) — they run commands as subprocesses with piped stdout.
 */
export function isInteractive(): boolean {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false
  if (process.env.CI === "true" || process.env.CI === "1") return false
  if (process.env.GITHUB_ACTIONS) return false
  if (process.env.TERM === "dumb") return false
  return true
}
