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
/** Returns the platform-specific command for opening URLs in a browser. */
export function openBrowserCmd(): string {
  return process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open"
}

export function isInteractive(): boolean {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false
  if (process.env.CI === "true" || process.env.CI === "1") return false
  if (process.env.GITHUB_ACTIONS) return false
  if (process.env.TERM === "dumb") return false
  return true
}
