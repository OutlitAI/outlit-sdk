import type { ArgsDef } from "citty"

export const paginationArgs = {
  limit: {
    type: "string",
    description: "Max results to return (1–100). Default: 20.",
    default: "20",
  },
  cursor: {
    type: "string",
    description:
      "Pagination cursor from a previous response (pagination.nextCursor).\nUse this to fetch the next page of results.",
  },
} satisfies ArgsDef

/** Applies pagination args (limit, cursor) to an API params object. */
export function applyPagination(
  params: Record<string, unknown>,
  args: { limit?: string; cursor?: string },
): void {
  if (args.limit) params.limit = Number(args.limit)
  if (args.cursor) params.cursor = args.cursor
}
