import { publicToolContracts } from "@outlit/tools"
import type { ArgsDef } from "citty"
import { outputError } from "../lib/output"

/** The page size the generated contract gives a tool's `limit` input. */
function contractPageSize(limit: { default: number; maximum: number }) {
  return { default: limit.default, max: limit.maximum } as const
}

/** Page size of the list tools, from the generated contract (25 by default, at most 100). */
export const PAGE_SIZE = contractPageSize(
  publicToolContracts.outlit_list_customers.inputSchema.properties.limit,
)

/** Page size of `outlit_search_customer_context`, from the generated contract. */
export const SEARCH_PAGE_SIZE = contractPageSize(
  publicToolContracts.outlit_search_customer_context.inputSchema.properties.limit,
)

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
    if (!Number.isInteger(n) || n < 1 || n > PAGE_SIZE.max) {
      outputError(
        {
          message: `--limit must be an integer between 1 and ${PAGE_SIZE.max} (got: ${args.limit})`,
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
