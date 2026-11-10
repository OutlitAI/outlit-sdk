import type { OutlitToolsResponseInfo } from "@outlit/tools"

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

/** Writes the response's deprecation and notices to stderr. */
export function reportResponseNotices(info: OutlitToolsResponseInfo): void {
  for (const line of responseNoticeLines(info)) process.stderr.write(`${line}\n`)
}
