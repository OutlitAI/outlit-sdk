import type { PublicToolName } from "./contracts.js"

/**
 * The property of each list tool's output that holds its rows. Core's list tools name it for what it
 * holds, so a generic reader needs this table: `items` for most, `facts`, `events`, `results` and
 * `rows` where the name says more. `tests/collections.test.ts` checks the table against the
 * generated output schemas, so a tool that gains or renames a collection fails the build here.
 */
export const collectionKeys = {
  outlit_list_customers: "items",
  outlit_list_customer_fields: "items",
  outlit_list_people: "items",
  outlit_list_members: "items",
  outlit_get_timeline: "events",
  outlit_list_facts: "facts",
  outlit_list_sources: "items",
  outlit_search_customer_context: "results",
  outlit_query: "rows",
  outlit_list_destinations: "items",
  outlit_list_integrations: "items",
  outlit_list_features: "items",
  outlit_list_tasks: "items",
  outlit_list_merge_suggestions: "items",
} as const satisfies Partial<Record<PublicToolName, string>>

export type CollectionToolName = keyof typeof collectionKeys

/** `page` of a list result: whether more rows follow and the cursor to send for them. */
export type CollectionPage = {
  hasMore: boolean
  nextCursor: string | null
  /** Every row that matches over all pages; absent or null when counting would cost a second read. */
  total?: number | null
}

/** `truncation` of a list result the gateway cut to fit its size cap; `next` says how to read the rest. */
export type CollectionTruncation = {
  truncated: true
  reason?: "byte_cap" | "row_cap"
  returned?: number
  next?: { instruction: string; tool?: string; input?: Record<string, unknown> }
} & Record<string, unknown>

export type Collection = {
  /** The output property the rows came from (`items`, `facts`, `events`, `results` or `rows`). */
  key: (typeof collectionKeys)[CollectionToolName]
  /** The rows; empty when the output holds none. */
  items: unknown[]
  /** Paging state; absent for a tool that does not page (search). */
  page?: CollectionPage
  /** Set when the gateway cut the rows to fit; absent when the list is whole. */
  truncation?: CollectionTruncation
}

export function isCollectionTool(toolName: string): toolName is CollectionToolName {
  return Object.hasOwn(collectionKeys, toolName)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * The rows, page and truncation of a list tool's output, wherever Core keeps them. Returns
 * `undefined` for a tool that returns no list (`outlit_get_customer`, the write tools). A list tool
 * whose output holds no rows gives `items: []`; check `truncation` and `page.hasMore` before
 * reading that as "nothing there".
 */
export function collectionOf(toolName: string, output: unknown): Collection | undefined {
  if (!isCollectionTool(toolName)) return undefined
  const key = collectionKeys[toolName]
  const record = isRecord(output) ? output : {}
  const rows = record[key]
  const page = record.page
  const truncation = record.truncation

  return {
    key,
    items: Array.isArray(rows) ? rows : [],
    ...(isRecord(page) && typeof page.hasMore === "boolean"
      ? { page: page as CollectionPage }
      : {}),
    ...(isRecord(truncation) && truncation.truncated === true
      ? { truncation: truncation as CollectionTruncation }
      : {}),
  }
}
