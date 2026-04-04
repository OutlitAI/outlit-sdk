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
): void {
  if (args["no-activity-in"]) params.noActivityInLast = args["no-activity-in"]
  if (args["has-activity-in"]) params.hasActivityInLast = args["has-activity-in"]
  if (args.search) params.search = args.search
  if (args["order-by"]) params.orderBy = args["order-by"]
  if (args["order-direction"]) params.orderDirection = args["order-direction"]
}
