import { describe, expect, test } from "bun:test"
import { normalizeProviderInput } from "../../src/lib/providers"

describe("normalizeProviderInput", () => {
  test("normalizes input shape without maintaining a provider registry", () => {
    expect(normalizeProviderInput("  Google Mail  ")).toBe("google-mail")
    expect(normalizeProviderInput("google_mail")).toBe("google-mail")
    expect(normalizeProviderInput("GMail")).toBe("gmail")
  })
})
