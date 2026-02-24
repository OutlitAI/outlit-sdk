import { isInteractive } from "./tty"

/**
 * Returns true when the CLI should produce machine-readable JSON output.
 *
 * True when the --json flag is set OR stdout is non-interactive (piped, CI, etc.).
 * Use this instead of repeating `json || !isInteractive()` in every command.
 */
export function isJsonMode(json: boolean): boolean {
  return json || !isInteractive()
}

/**
 * Write successful command output as pretty-printed JSON to stdout.
 *
 * Table formatting for list commands is handled by `runTool` in `api.ts`.
 * Never use console.log() directly in commands — always call outputResult().
 */
export function outputResult(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

/**
 * Write an error and exit with code 1.
 *
 * In JSON mode: writes { "error": "message string" } to stderr.
 * In TTY mode: writes "Error: message" to stderr.
 *
 * Typed as `never` because it always calls process.exit() — TypeScript
 * uses this to eliminate dead-code guard clauses after error calls.
 */
export function outputError(error: { message: string; code?: string }, json: boolean): never {
  if (isJsonMode(json)) {
    const body: Record<string, string> = { error: error.message }
    if (error.code) body.code = error.code
    process.stderr.write(`${JSON.stringify(body, null, 2)}\n`)
  } else {
    console.error(`Error: ${error.message}`)
  }
  process.exit(1)
}

/** Extract a message string from an unknown caught value */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
