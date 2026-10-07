import type { OutlitOptions } from "./tracker"

/**
 * Parse the `data-auto-track` script-tag attribute into an autoTrack option.
 * Absent or unrecognized values return undefined so the SDK default applies.
 */
export function parseDataAutoTrack(
  value: string | null,
): NonNullable<OutlitOptions["autoTrack"]> | undefined {
  if (value === "true") return true
  if (value === "false") return false
  if (value === "auto") return "auto"
  return undefined
}
