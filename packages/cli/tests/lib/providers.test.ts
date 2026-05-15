import { describe, expect, test } from "bun:test"
import { normalizeProviderInput, PROVIDER_NAMES } from "../../src/lib/providers"

describe("PROVIDER_NAMES", () => {
  test("is sorted alphabetically", () => {
    const sorted = [...PROVIDER_NAMES].sort()
    expect([...PROVIDER_NAMES]).toEqual(sorted)
  })

  test("contains public provider names and common aliases for help/completions", () => {
    expect(PROVIDER_NAMES).toContain("gmail")
    expect(PROVIDER_NAMES).toContain("google-mail")
    expect(PROVIDER_NAMES).toContain("stripe")
    expect(PROVIDER_NAMES).toContain("pylon")
    expect(PROVIDER_NAMES).toContain("salesforce")
    expect(PROVIDER_NAMES.every((provider) => !provider.endsWith("-api-key"))).toBe(true)
    expect(PROVIDER_NAMES).not.toContain("gong")
  })
})

describe("normalizeProviderInput", () => {
  test("normalizes user input shape without resolving aliases locally", () => {
    expect(normalizeProviderInput("  Google Mail  ")).toBe("google-mail")
    expect(normalizeProviderInput("google_mail")).toBe("google-mail")
    expect(normalizeProviderInput("GMail")).toBe("gmail")
    expect(normalizeProviderInput("stripe")).toBe("stripe")
  })
})
