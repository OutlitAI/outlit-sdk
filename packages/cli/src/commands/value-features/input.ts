import { errorMessage, outputError } from "../../lib/output"
import { parseIntegerFlag } from "../../lib/platform-input"

export function parseBoundedInteger(
  value: string | number | undefined,
  fallback: number,
  flag: string,
  min: number,
  max: number,
  json: boolean,
): number {
  const parsed = parseIntegerFlag(value, fallback, flag, json)
  if (parsed < min || parsed > max) {
    return outputError(
      { message: `${flag} must be an integer from ${min} to ${max}`, code: "invalid_input" },
      json,
    )
  }
  return parsed
}

export function parsePropertyFilters(value: string | undefined, json: boolean): unknown[] {
  if (!value?.trim()) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return outputError(
        { message: "--property-filters must be a JSON array", code: "invalid_input" },
        json,
      )
    }
    return parsed
  } catch (error) {
    return outputError(
      {
        message: `Invalid --property-filters JSON: ${errorMessage(error, "parse failed")}`,
        code: "invalid_input",
      },
      json,
    )
  }
}
