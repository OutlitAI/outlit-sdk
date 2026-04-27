import type { ArgsDef } from "citty"

export const activityFilterArgs = {
  "no-activity-in": {
    type: "string",
    description: "Filter by no activity in the last period (7d, 14d, 30d, 90d)",
  },
  "has-activity-in": {
    type: "string",
    description: "Filter by activity in the last period (7d, 14d, 30d, 90d)",
  },
} satisfies ArgsDef

export const orderArgs = {
  "order-by": {
    type: "string",
    description: "Sort field (default: last_activity_at)",
    default: "last_activity_at",
  },
  "order-direction": {
    type: "string",
    description: "Sort direction (asc, desc)",
    default: "desc",
  },
} satisfies ArgsDef

export const traitFilterArgs = {
  trait: {
    type: "string",
    description:
      "Filter by traits using key=value pairs. Separate multiple filters with commas (e.g. role=admin,active=true)",
  },
} satisfies ArgsDef

function findRawStringFlagValue(
  rawArgs: string[] | undefined,
  flagName: string,
): string | undefined {
  if (!rawArgs) return undefined

  const flag = `--${flagName}`
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (!arg) continue

    if (arg.startsWith(`${flag}=`)) {
      const value = arg.slice(flag.length + 1)
      return value.length > 0 ? value : undefined
    }

    if (arg === flag) {
      const value = rawArgs[i + 1]
      if (!value || value.startsWith("-")) return undefined
      return value
    }
  }

  return undefined
}

function readStringArg(
  args: Record<string, unknown>,
  flagName: string,
  rawArgs: string[] | undefined,
): string | undefined {
  const value = args[flagName]
  if (typeof value === "string" && value.length > 0) return value

  return findRawStringFlagValue(rawArgs, flagName)
}

function parseTraitFilterValue(value: string): string | number | boolean {
  if (value === "true") return true
  if (value === "false") return false

  const parsed = Number(value)
  if (value.trim() !== "" && Number.isFinite(parsed)) {
    return parsed
  }

  return value
}

export function parseTraitFilters(
  input: string | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!input) return undefined

  const entries = input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (entries.length === 0) return undefined

  const filters: Record<string, string | number | boolean> = {}

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=")
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error(`Invalid trait filter "${entry}". Expected key=value.`)
    }

    const key = entry.slice(0, separatorIndex).trim()
    const rawValue = entry.slice(separatorIndex + 1).trim()

    if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
      throw new Error(
        `Invalid trait filter key "${key}". Keys may only contain letters, numbers, underscores, and dashes.`,
      )
    }

    filters[key] = parseTraitFilterValue(rawValue)
  }

  return filters
}

/** Applies activity filters, search, and ordering to an API params object. */
export function applyListFilters(
  params: Record<string, unknown>,
  args: {
    "no-activity-in"?: string
    "has-activity-in"?: string
    search?: string
    "order-by"?: string
    "order-direction"?: string
  },
  rawArgs?: string[],
): void {
  const argsRecord = args as Record<string, unknown>
  const noActivityIn = readStringArg(argsRecord, "no-activity-in", rawArgs)
  const hasActivityIn = readStringArg(argsRecord, "has-activity-in", rawArgs)

  if (noActivityIn) params.noActivityInLast = noActivityIn
  if (hasActivityIn) params.hasActivityInLast = hasActivityIn
  if (args.search) params.search = args.search
  if (args["order-by"]) params.orderBy = args["order-by"]
  if (args["order-direction"]) params.orderDirection = args["order-direction"]
}
