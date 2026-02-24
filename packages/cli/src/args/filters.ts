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
