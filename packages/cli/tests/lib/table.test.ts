import { describe, expect, test } from "bun:test"
import { renderPaginationHint, renderTable } from "../../src/lib/table"
import { isUnicodeSupported } from "../../src/lib/tty"

// Match the runtime BOX characters so tests work on any platform
const TL = isUnicodeSupported ? String.fromCodePoint(0x250c) : "+"
const TR = isUnicodeSupported ? String.fromCodePoint(0x2510) : "+"
const BL = isUnicodeSupported ? String.fromCodePoint(0x2514) : "+"
const BR = isUnicodeSupported ? String.fromCodePoint(0x2518) : "+"
const H = isUnicodeSupported ? String.fromCodePoint(0x2500) : "-"
const V = isUnicodeSupported ? String.fromCodePoint(0x2502) : "|"
const LT = isUnicodeSupported ? String.fromCodePoint(0x251c) : "+"
const RT = isUnicodeSupported ? String.fromCodePoint(0x2524) : "+"
const CR = isUnicodeSupported ? String.fromCodePoint(0x253c) : "+"

describe("renderTable", () => {
  test("returns emptyMessage when rows is empty", () => {
    expect(renderTable(["Name", "Email"], [])).toBe("(no results)")
    expect(renderTable(["A"], [], "nothing here")).toBe("nothing here")
  })

  test("renders single row with box-drawing characters", () => {
    const output = renderTable(["Name", "Age"], [["Alice", "30"]])
    expect(output).toContain(TL)
    expect(output).toContain(TR)
    expect(output).toContain(BL)
    expect(output).toContain(BR)
    expect(output).toContain(V)
    expect(output).toContain(H)
    expect(output).toContain("Alice")
    expect(output).toContain("30")
  })

  test("renders multiple rows", () => {
    const output = renderTable(
      ["Name", "City"],
      [
        ["Alice", "NYC"],
        ["Bob", "LA"],
      ],
    )
    expect(output).toContain("Alice")
    expect(output).toContain("Bob")
    expect(output).toContain("NYC")
    expect(output).toContain("LA")
  })

  test("pads columns to widest value", () => {
    const output = renderTable(
      ["Key", "Value"],
      [
        ["short", "a very long value here"],
        ["much longer key", "v"],
      ],
    )
    const lines = output.split("\n")
    // All lines should have the same length (box is rectangular)
    const lengths = lines.map((l) => l.length)
    expect(new Set(lengths).size).toBe(1)
  })

  test("includes header separator", () => {
    const output = renderTable(["A", "B"], [["1", "2"]])
    expect(output).toContain(LT)
    expect(output).toContain(CR)
    expect(output).toContain(RT)
  })
})

describe("renderPaginationHint", () => {
  test("shows cursor hint when hasMore is true", () => {
    const hint = renderPaginationHint({ hasMore: true, nextCursor: "abc123", total: 100 }, 20)
    expect(hint).toContain("20 of 100")
    expect(hint).toContain("--cursor abc123")
  })

  test("shows total when all results shown", () => {
    const hint = renderPaginationHint({ hasMore: false, nextCursor: null, total: 5 }, 5)
    expect(hint).toContain("all 5 results")
  })

  test("returns empty string when itemCount is 0", () => {
    expect(renderPaginationHint({ hasMore: false, nextCursor: null, total: 0 }, 0)).toBe("")
  })
})
