/**
 * Renders a Unicode box-drawing table. Zero dependencies.
 *
 * @param headers - Column header strings
 * @param rows - 2D array of cell values (must match headers length)
 * @param emptyMessage - Message when rows is empty (default: "(no results)")
 * @returns Multi-line string ready for console.log
 */
export function renderTable(
  headers: string[],
  rows: string[][],
  emptyMessage = "(no results)",
): string {
  if (rows.length === 0) return emptyMessage

  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)))

  const border = (left: string, mid: string, right: string) =>
    `${left}${widths.map((w) => "─".repeat(w + 2)).join(mid)}${right}`

  const formatRow = (cells: string[]) =>
    `│${cells.map((c, i) => ` ${(c ?? "").padEnd(widths[i] ?? 0)} `).join("│")}│`

  return [
    border("┌", "┬", "┐"),
    formatRow(headers),
    border("├", "┼", "┤"),
    ...rows.map(formatRow),
    border("└", "┴", "┘"),
  ].join("\n")
}

/**
 * Formats a pagination hint line for TTY display after a table.
 * Returns empty string when there are no items.
 */
export function renderPaginationHint(
  pagination: { hasMore: boolean; nextCursor: string | null; total: number },
  itemCount: number,
): string {
  if (itemCount === 0) return ""
  if (pagination.hasMore && pagination.nextCursor) {
    return `Showing ${itemCount} of ${pagination.total} total. Next page: --cursor ${pagination.nextCursor}`
  }
  return `Showing all ${pagination.total} results.`
}
