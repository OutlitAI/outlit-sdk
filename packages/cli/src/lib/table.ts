import { isUnicodeSupported } from "./tty"

// Box-drawing characters generated at runtime to avoid encoding issues
// when the bundled file is read as Latin-1 instead of UTF-8.
// Falls back to ASCII on Windows terminals without Unicode support.
const BOX = isUnicodeSupported
  ? {
      h: String.fromCodePoint(0x2500), // ─
      v: String.fromCodePoint(0x2502), // │
      tl: String.fromCodePoint(0x250c), // ┌
      tr: String.fromCodePoint(0x2510), // ┐
      bl: String.fromCodePoint(0x2514), // └
      br: String.fromCodePoint(0x2518), // ┘
      lt: String.fromCodePoint(0x251c), // ├
      rt: String.fromCodePoint(0x2524), // ┤
      tt: String.fromCodePoint(0x252c), // ┬
      bt: String.fromCodePoint(0x2534), // ┴
      cr: String.fromCodePoint(0x253c), // ┼
    }
  : {
      h: "-",
      v: "|",
      tl: "+",
      tr: "+",
      bl: "+",
      br: "+",
      lt: "+",
      rt: "+",
      tt: "+",
      bt: "+",
      cr: "+",
    }

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
    `${left}${widths.map((w) => BOX.h.repeat(w + 2)).join(mid)}${right}`

  const formatRow = (cells: string[]) =>
    `${BOX.v}${cells.map((c, i) => ` ${(c ?? "").padEnd(widths[i] ?? 0)} `).join(BOX.v)}${BOX.v}`

  return [
    border(BOX.tl, BOX.tt, BOX.tr),
    formatRow(headers),
    border(BOX.lt, BOX.cr, BOX.rt),
    ...rows.map(formatRow),
    border(BOX.bl, BOX.bt, BOX.br),
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
