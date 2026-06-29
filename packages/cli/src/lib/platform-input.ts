import { readFileSync } from "node:fs"
import { errorMessage, outputError } from "./output"

export function parseCsvList(raw: string | undefined): string[] {
  if (!raw) return []

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export function requiredTrimmedString(
  value: string | undefined,
  flag: string,
  json: boolean,
): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return outputError({ message: `Provide ${flag}`, code: "missing_input" }, json)
  }

  return trimmed
}

export function optionalTrimmedString(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function parseIntegerFlag(
  value: string | number | undefined,
  fallback: number,
  flag: string,
  json: boolean,
): number {
  if (value === undefined) return fallback
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(parsed)) {
    return outputError({ message: `${flag} must be an integer`, code: "invalid_input" }, json)
  }

  return parsed
}

export function readJsonBodyOrExit(input: {
  data?: string
  file?: string
  json: boolean
}): Record<string, unknown> {
  const raw = input.file
    ? (() => {
        try {
          return readFileSync(input.file, "utf-8")
        } catch (error) {
          return outputError(
            {
              message: `Cannot read file: ${errorMessage(error, "unknown error")}`,
              code: "file_error",
            },
            input.json,
          )
        }
      })()
    : input.data

  if (!raw) {
    return outputError({ message: "Provide --data or --file", code: "missing_input" }, input.json)
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return outputError(
        { message: "JSON input must be an object", code: "invalid_input" },
        input.json,
      )
    }

    return parsed as Record<string, unknown>
  } catch (error) {
    return outputError(
      {
        message: `Invalid JSON input: ${errorMessage(error, "parse failed")}`,
        code: "invalid_input",
      },
      input.json,
    )
  }
}
