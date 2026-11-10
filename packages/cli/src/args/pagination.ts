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

/** Page size of the v2 list tools (timeline, sources, facts): default 25, max 100. */
export const PAGE_SIZE = { default: 25, max: 100 } as const

/** Pagination flags for the v2 list tools, which return `page.nextCursor`. */
export const pageSizeArgs = {
  limit: {
    type: "string",
    description: `Max results to return (1-${PAGE_SIZE.max}). Default: ${PAGE_SIZE.default}.`,
    default: String(PAGE_SIZE.default),
  },
  cursor: {
    type: "string",
    description:
      "Pagination cursor from a previous response (page.nextCursor).\nUse this to fetch the next page of results.",
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
