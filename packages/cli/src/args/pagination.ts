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
  if (args.limit) {
    const n = Number(args.limit)
    if (Number.isNaN(n) || n < 1 || n > 100) {
      throw new Error(`--limit must be an integer between 1 and 100 (got: ${args.limit})`)
    }
    params.limit = n
  }
  if (args.cursor) params.cursor = args.cursor
}
