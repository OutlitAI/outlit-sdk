import { describe, expect, test } from "bun:test"
import { INTEGRATION_PROVIDERS, PROVIDER_NAMES, resolveProvider } from "../../src/lib/providers"

describe("INTEGRATION_PROVIDERS", () => {
  test("maps gmail to google-mail internal id", () => {
    expect(INTEGRATION_PROVIDERS.gmail?.id).toBe("google-mail")
  })

  test("accepts google-mail as the canonical provider id", () => {
    expect(INTEGRATION_PROVIDERS["google-mail"]?.id).toBe("google-mail")
  })

  test("maps stripe to brex-api-key internal id", () => {
    expect(INTEGRATION_PROVIDERS.stripe?.id).toBe("brex-api-key")
  })

  test("all entries have required fields", () => {
    for (const [key, info] of Object.entries(INTEGRATION_PROVIDERS)) {
      expect(info.id).toBeString()
      expect(info.name).toBeString()
      expect(info.category).toBeString()
      expect(info.authType).toBeString()
      expect(key).toBeTruthy()
    }
  })

  test("OAuth providers have no configFields", () => {
    const oauthProviders = Object.values(INTEGRATION_PROVIDERS).filter(
      (p) => p.authType === "oauth",
    )
    expect(oauthProviders.length).toBeGreaterThan(0)
    for (const p of oauthProviders) {
      expect(p.configFields).toBeUndefined()
    }
  })

  test("API-key providers have configFields", () => {
    const apiKeyProviders = Object.values(INTEGRATION_PROVIDERS).filter(
      (p) => p.authType === "api_key",
    )
    expect(apiKeyProviders.length).toBeGreaterThan(0)
    for (const p of apiKeyProviders) {
      expect(p.configFields).toBeDefined()
      expect(p.configFields!.length).toBeGreaterThan(0)
    }
  })

  test("includes supabase provider", () => {
    const supabase = INTEGRATION_PROVIDERS.supabase!
    expect(supabase).toBeDefined()
    expect(supabase.id).toBe("supabase")
    expect(supabase.category).toBe("data")
    expect(supabase.authType).toBe("api_key")
    expect(supabase.configFields).toEqual([
      { key: "projectUrl", label: "Project URL" },
      { key: "serviceRoleKey", label: "Service Role Key", secret: true },
    ])
  })

  test("includes clerk provider", () => {
    const clerk = INTEGRATION_PROVIDERS.clerk!
    expect(clerk).toBeDefined()
    expect(clerk.id).toBe("clerk")
    expect(clerk.category).toBe("auth")
    expect(clerk.authType).toBe("api_key")
    expect(clerk.configFields).toEqual([{ key: "secretKey", label: "Secret Key", secret: true }])
  })
})

describe("PROVIDER_NAMES", () => {
  test("is sorted alphabetically", () => {
    const sorted = [...PROVIDER_NAMES].sort()
    expect(PROVIDER_NAMES).toEqual(sorted)
  })

  test("includes all expected providers", () => {
    expect(PROVIDER_NAMES).toContain("slack")
    expect(PROVIDER_NAMES).toContain("gmail")
    expect(PROVIDER_NAMES).toContain("google-mail")
    expect(PROVIDER_NAMES).toContain("stripe")
    expect(PROVIDER_NAMES).toContain("google-calendar")
    expect(PROVIDER_NAMES).toContain("fireflies")
    expect(PROVIDER_NAMES).toContain("granola")
    expect(PROVIDER_NAMES).toContain("hubspot")
    expect(PROVIDER_NAMES).toContain("posthog")
    expect(PROVIDER_NAMES).toContain("supabase")
    expect(PROVIDER_NAMES).toContain("clerk")
    expect(PROVIDER_NAMES).toContain("pylon")
  })

  test("does not include removed CRM providers that are not exposed by integrations list", () => {
    expect(PROVIDER_NAMES).not.toContain("salesforce")
    expect(PROVIDER_NAMES).not.toContain("attio")
    expect(PROVIDER_NAMES).not.toContain("gong")
  })
})

describe("resolveProvider", () => {
  test("returns provider on exact match", () => {
    const result = resolveProvider("slack")
    expect("provider" in result).toBe(true)
    if ("provider" in result) {
      expect(result.provider.id).toBe("slack")
      expect(result.cliName).toBe("slack")
    }
  })

  test("matches case-insensitively", () => {
    const result = resolveProvider("Slack")
    expect("provider" in result).toBe(true)
    if ("provider" in result) {
      expect(result.provider.id).toBe("slack")
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
    const result = resolveProvider("sla")
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.suggestion).toBe("slack")
      expect(result.error).toContain('Did you mean "slack"')
    }
  })

  test("suggests when input is a prefix of a provider name", () => {
    const result = resolveProvider("pos")
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.suggestion).toBe("posthog")
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

  test("resolves provider IDs exposed by integrations list", () => {
    for (const name of ["google-mail", "granola", "hubspot"]) {
      const result = resolveProvider(name)
      expect("provider" in result).toBe(true)
      if ("provider" in result) {
        expect(result.provider.id).toBe(name)
        expect(result.cliName).toBe(name)
      }
    }
  })

  test("resolves new providers (supabase, clerk)", () => {
    for (const name of ["supabase", "clerk"]) {
      const result = resolveProvider(name)
      expect("provider" in result).toBe(true)
      if ("provider" in result) {
        expect(result.provider.authType).toBe("api_key")
      }
    }
  })
})
