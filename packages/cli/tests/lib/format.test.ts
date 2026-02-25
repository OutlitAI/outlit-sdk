import { describe, expect, test } from "bun:test"
import { formatCents, relativeDate, truncate } from "../../src/lib/format"

describe("formatCents", () => {
  test("converts cents to dollar string", () => {
    expect(formatCents(10000)).toBe("$100.00")
    expect(formatCents(0)).toBe("$0.00")
    expect(formatCents(99)).toBe("$0.99")
    expect(formatCents(123456)).toBe("$1234.56")
  })

  test("returns -- for null, undefined, non-numeric", () => {
    expect(formatCents(null)).toBe("--")
    expect(formatCents(undefined)).toBe("--")
    expect(formatCents("not a number")).toBe("--")
  })
})

describe("relativeDate", () => {
  test("returns relative time for recent dates", () => {
    const now = Date.now()
    expect(relativeDate(new Date(now - 30_000).toISOString())).toBe("just now")
    expect(relativeDate(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago")
    expect(relativeDate(new Date(now - 3 * 3600_000).toISOString())).toBe("3h ago")
    expect(relativeDate(new Date(now - 7 * 86400_000).toISOString())).toBe("7d ago")
  })

  test("returns -- for null, undefined, non-string", () => {
    expect(relativeDate(null)).toBe("--")
    expect(relativeDate(undefined)).toBe("--")
    expect(relativeDate(42)).toBe("--")
  })

  test("returns 'just now' for future dates", () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(relativeDate(future)).toBe("just now")
  })
})

describe("truncate", () => {
  test("leaves short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello")
    expect(truncate("exact", 5)).toBe("exact")
  })

  test("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...")
    expect(truncate("abcdefghij", 6)).toBe("abc...")
  })

  test("returns -- for null, undefined", () => {
    expect(truncate(null, 10)).toBe("--")
    expect(truncate(undefined, 10)).toBe("--")
  })

  test("converts non-strings via String()", () => {
    expect(truncate(12345, 10)).toBe("12345")
  })
})
