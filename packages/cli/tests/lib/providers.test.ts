import { describe, expect, test } from "bun:test"
import { INTEGRATION_PROVIDERS, PROVIDER_NAMES, resolveProvider } from "../../src/lib/providers"

describe("INTEGRATION_PROVIDERS", () => {
  test("maps gmail to google-mail internal id", () => {
    expect(INTEGRATION_PROVIDERS["gmail"]?.id).toBe("google-mail")
  })

  test("maps stripe to brex-api-key internal id", () => {
    expect(INTEGRATION_PROVIDERS["stripe"]?.id).toBe("brex-api-key")
  })

  test("all entries have required fields", () => {
    for (const [key, info] of Object.entries(INTEGRATION_PROVIDERS)) {
      expect(info.id).toBeString()
      expect(info.name).toBeString()
      expect(info.category).toBeString()
      expect(key).toBeTruthy()
    }
  })
})

describe("PROVIDER_NAMES", () => {
  test("is sorted alphabetically", () => {
    const sorted = [...PROVIDER_NAMES].sort()
    expect(PROVIDER_NAMES).toEqual(sorted)
  })

  test("includes all expected providers", () => {
    expect(PROVIDER_NAMES).toContain("salesforce")
    expect(PROVIDER_NAMES).toContain("gmail")
    expect(PROVIDER_NAMES).toContain("slack")
    expect(PROVIDER_NAMES).toContain("stripe")
    expect(PROVIDER_NAMES).toContain("google-calendar")
  })
})

describe("resolveProvider", () => {
  test("returns provider on exact match", () => {
    const result = resolveProvider("salesforce")
    expect("provider" in result).toBe(true)
    if ("provider" in result) {
      expect(result.provider.id).toBe("salesforce")
      expect(result.cliName).toBe("salesforce")
    }
  })

  test("matches case-insensitively", () => {
    const result = resolveProvider("Salesforce")
    expect("provider" in result).toBe(true)
    if ("provider" in result) {
      expect(result.provider.id).toBe("salesforce")
    }
  })

  test("trims whitespace", () => {
    const result = resolveProvider("  slack  ")
    expect("provider" in result).toBe(true)
    if ("provider" in result) {
      expect(result.provider.id).toBe("slack")
    }
  })

  test("returns error for unknown provider", () => {
    const result = resolveProvider("unknown-provider")
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error).toContain("Unknown integration")
      expect(result.error).toContain("Available:")
    }
  })

  test("suggests matching provider via prefix", () => {
    const result = resolveProvider("sale")
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.suggestion).toBe("salesforce")
      expect(result.error).toContain('Did you mean "salesforce"')
    }
  })

  test("suggests when input is a prefix of a provider name", () => {
    const result = resolveProvider("hub")
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.suggestion).toBe("hubspot")
    }
  })

  test("no suggestion for completely unrelated input", () => {
    const result = resolveProvider("zzzzz")
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.suggestion).toBeUndefined()
    }
  })

  test("resolves gmail alias to google-mail id", () => {
    const result = resolveProvider("gmail")
    expect("provider" in result).toBe(true)
    if ("provider" in result) {
      expect(result.provider.id).toBe("google-mail")
      expect(result.provider.name).toBe("Gmail")
      expect(result.cliName).toBe("gmail")
    }
  })
})
