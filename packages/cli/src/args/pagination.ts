import type { ArgsDef } from "citty"
import { outputError } from "../lib/output"

export const paginationArgs = {
  limit: {
    type: "string",
    description: "Max results to return (1-100). Default: 20.",
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
  json: boolean,
): void {
  if (args.limit) {
    const n = Number(args.limit)
    if (Number.isNaN(n) || n < 1 || n > 100) {
      outputError(
        {
          message: `--limit must be an integer between 1 and 100 (got: ${args.limit})`,
          code: "invalid_input",
        },
        json,
      )
      return
    }
    params.limit = n
  }
  if (args.cursor) params.cursor = args.cursor
}
