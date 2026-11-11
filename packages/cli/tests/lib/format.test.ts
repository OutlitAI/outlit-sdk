import { describe, expect, test } from "bun:test"
import {
  capitalize,
  formatArr,
  formatCents,
  formatCredits,
  formatMeter,
  formatNumber,
  relativeDate,
  truncate,
} from "../../src/lib/format"

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

describe("formatArr", () => {
  const arr = (formatted: string, estimated = false) => ({
    value: { amount: 1200000, currency: "USD", decimals: 2, formatted },
    estimated,
    lifecycle: "active",
  })

  test("shows the Money's own formatted text", () => {
    expect(formatArr(arr("$12,000.00"))).toBe("$12,000.00")
    expect(formatArr(arr("\u20ac12,000.00"))).toBe("\u20ac12,000.00")
  })

  test("marks estimates with ~", () => {
    expect(formatArr(arr("$12,000.00", true))).toBe("~$12,000.00")
  })

  test("returns -- when ARR is unknown", () => {
    expect(formatArr(null)).toBe("--")
    expect(formatArr(undefined)).toBe("--")
    expect(formatArr({ value: null, estimated: false })).toBe("--")
    expect(formatArr({ value: { amount: 1, currency: "USD" } })).toBe("--")
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

describe("capitalize", () => {
  test("capitalizes first letter", () => {
    expect(capitalize("crm")).toBe("Crm")
    expect(capitalize("communication")).toBe("Communication")
  })

  test("handles single character", () => {
    expect(capitalize("a")).toBe("A")
  })

  test("handles already capitalized", () => {
    expect(capitalize("Already")).toBe("Already")
  })

  test("returns -- for null, undefined, non-string", () => {
    expect(capitalize(null)).toBe("--")
    expect(capitalize(undefined)).toBe("--")
    expect(capitalize(42)).toBe("--")
  })
})

describe("formatNumber", () => {
  test("formats numbers with locale separators", () => {
    expect(formatNumber(0)).toBe("0")
    expect(formatNumber(42)).toBe("42")
    // Large numbers get separators (locale-dependent, but at least formatted)
    const result = formatNumber(1234567)
    expect(result).toContain("1")
    expect(result).toContain("234")
    expect(result).toContain("567")
  })

  test("returns -- for null, undefined, non-numeric", () => {
    expect(formatNumber(null)).toBe("--")
    expect(formatNumber(undefined)).toBe("--")
    expect(formatNumber("not a number")).toBe("--")
  })
})

describe("formatCredits", () => {
  test("names when the soonest pool runs out and what is left", () => {
    expect(
      formatCredits({
        runsOutAt: "2026-12-01T08:30:00.000Z",
        pool: { id: "pool_1", name: "Monthly" },
        balance: { remaining: 1200, granted: 5000 },
      }),
    ).toBe("runs out 2026-12-01 (1,200 left of 5,000)")
    expect(
      formatCredits({
        runsOutAt: "2026-12-01T08:30:00.000Z",
        pool: { id: "pool_1", name: null },
        balance: { remaining: 40, granted: null },
      }),
    ).toBe("runs out 2026-12-01 (40 left)")
  })

  test("returns -- for a row without a forecast", () => {
    expect(formatCredits(undefined)).toBe("--")
    expect(formatCredits(null)).toBe("--")
    expect(formatCredits({ pool: {} })).toBe("--")
  })
})

describe("formatMeter", () => {
  test("shows the reported usage, and how many accounts it sums when more than one", () => {
    expect(formatMeter({ feature: "api_calls", reported: 1204, accounts: 1, observed: null })).toBe(
      "1,204",
    )
    expect(formatMeter({ feature: "api_calls", reported: 9500, accounts: 3, observed: null })).toBe(
      "9,500 (3 accounts)",
    )
  })

  test("returns -- for a row without a meter", () => {
    expect(formatMeter(undefined)).toBe("--")
    expect(formatMeter({ feature: "api_calls" })).toBe("--")
  })
})
