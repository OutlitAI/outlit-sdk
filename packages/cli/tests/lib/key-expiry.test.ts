import { describe, expect, spyOn, test } from "bun:test"
import { apiKeyContractHeader } from "@outlit/tools"
import { pingApiKey } from "../../src/lib/api"
import { keyExpiryWarning } from "../../src/lib/key-expiry"
import { TEST_API_KEY } from "../helpers"

const DAY_MS = 24 * 60 * 60 * 1000

function validation(apiKey: Record<string, unknown> = {}) {
  return {
    valid: true,
    organizationId: "org_123",
    createdById: "user_123",
    apiKey: {
      id: "key_123",
      name: "Local CLI",
      prefix: "ok_ABC123",
      keyType: "cli",
      grants: ["customer_intelligence:read"],
      createdAt: "2026-10-01T00:00:00.000Z",
      lastUsedAt: null,
      totalRequests: 1,
      ...apiKey,
    },
    authorization: { grants: ["customer_intelligence:read"] },
  }
}

describe("keyExpiryWarning()", () => {
  const now = new Date("2026-10-05T12:00:00.000Z")
  const inDays = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString()

  test("warns within 14 days of expiry and points to outlit login", () => {
    expect(keyExpiryWarning(inDays(10), now)).toBe(
      "Warning: your Outlit API key expires in 10 days. Run `outlit login` to get a new one.\n",
    )
    expect(keyExpiryWarning(inDays(14), now)).toContain("expires in 14 days")
    expect(keyExpiryWarning(inDays(0.5), now)).toContain("expires in 1 day.")
  })

  test("says nothing for a distant, past, missing or unreadable expiry", () => {
    expect(keyExpiryWarning(inDays(15), now)).toBeNull()
    expect(keyExpiryWarning(inDays(-1), now)).toBeNull()
    expect(keyExpiryWarning(null, now)).toBeNull()
    expect(keyExpiryWarning(undefined, now)).toBeNull()
    expect(keyExpiryWarning("soon", now)).toBeNull()
  })
})

describe("pingApiKey() and key expiry", () => {
  test("asks for the v2 validation contract and still accepts a v1 response", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validation()), { status: 200 }),
    )
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    try {
      expect(await pingApiKey(TEST_API_KEY)).toEqual(validation() as never)
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
      expect(new Headers(init?.headers).get(apiKeyContractHeader)).toBe("2")
      expect(stderrSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
      stderrSpy.mockRestore()
    }
  })

  test("warns once per run on stderr when a v2 response says the key expires soon", async () => {
    const expiresAt = new Date(Date.now() + 3 * DAY_MS).toISOString()
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      (async () =>
        new Response(JSON.stringify(validation({ expiresAt })), {
          status: 200,
        })) as unknown as typeof fetch,
    )
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await expect(pingApiKey(TEST_API_KEY)).resolves.toMatchObject({ apiKey: { expiresAt } })
      await pingApiKey(TEST_API_KEY)

      const warnings = stderrSpy.mock.calls.map((call) => String(call[0]))
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain("outlit login")
      expect(stdoutSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
      stderrSpy.mockRestore()
      stdoutSpy.mockRestore()
    }
  })

  test("accepts a v2 response for a key that never expires without warning", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validation({ keyType: "api", expiresAt: null })), {
        status: 200,
      }),
    )
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    try {
      await expect(pingApiKey(TEST_API_KEY)).resolves.toMatchObject({
        apiKey: { expiresAt: null },
      })
      expect(stderrSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
      stderrSpy.mockRestore()
    }
  })
})
