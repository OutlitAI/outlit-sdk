import type { OutlitToolsResponseInfo } from "@outlit/tools"
import { isJsonMode } from "./output"

/**
 * The stderr lines for what the gateway said beside a result: a deprecation when the call used a
 * retired tool name, and one line per notice about an input it changed. Stdout stays the result.
 */
export function responseNoticeLines(info: OutlitToolsResponseInfo): string[] {
  const lines: string[] = []
  if (info.deprecation) {
    lines.push(`Warning: ${info.deprecation.message} (until ${info.deprecation.until})`)
  }
  for (const notice of info.notices) lines.push(`Note: ${notice}`)
  return lines
}

/** True when the command line asks for `--verbose`: the request id and output version of each call. */
export function isVerbose(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--verbose")
}

/**
 * With `--verbose`, the request id and output version Core sent for a call: two lines for a person,
 * one JSON line when output is JSON, so stdout stays the result either way. Quote the request id
 * when reporting a problem.
 */
export function responseMetaLines(info: OutlitToolsResponseInfo, json: boolean): string[] {
  if (!info.requestId && !info.version) return []
  if (json) {
    return [
      JSON.stringify({
        ...(info.requestId ? { requestId: info.requestId } : {}),
        ...(info.version ? { version: info.version } : {}),
      }),
    ]
  }
  return [
    ...(info.requestId ? [`Request ID: ${info.requestId}`] : []),
    ...(info.version ? [`API version: ${info.version}`] : []),
  ]
}

/** Writes the response's deprecation and notices to stderr, and with `--verbose` its request id and version. */
export function reportResponseNotices(info: OutlitToolsResponseInfo): void {
  for (const line of responseNoticeLines(info)) process.stderr.write(`${line}\n`)
  if (isVerbose()) {
    const json = isJsonMode(process.argv.includes("--json"))
    for (const line of responseMetaLines(info, json)) process.stderr.write(`${line}\n`)
  }
}
