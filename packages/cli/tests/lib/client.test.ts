import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { TEST_API_KEY } from "../helpers"

describe("createClient()", () => {
  let originalEnv: string | undefined
  let originalXdg: string | undefined

  beforeEach(() => {
    originalEnv = process.env.OUTLIT_API_KEY
    originalXdg = process.env.XDG_CONFIG_HOME
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    // Point config dir to a non-existent path so resolveApiKey never finds a credentials file
    process.env.XDG_CONFIG_HOME = "/tmp/outlit-test-no-config"
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OUTLIT_API_KEY = originalEnv
    } else {
      Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    }
    if (originalXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdg
    } else {
      Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
    }
    Reflect.deleteProperty(process.env, "OUTLIT_API_URL")
  })

  test("throws when no API key is found", async () => {
    const { createClient } = await import("../../src/lib/client")
    await expect(createClient()).rejects.toThrow("No API key found")
  })

  test("throws when API key has invalid format", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = "invalid_key_no_ok_prefix"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("throws when API key is too short (prefix only)", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = "ok_short"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("returns client with key and baseUrl when key is valid", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    expect(client.key).toBe(TEST_API_KEY)
    expect(client.baseUrl).toBe("https://app.outlit.ai")
  })

  test("uses OUTLIT_API_URL env var to override base URL", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.OUTLIT_API_URL = "http://localhost:3000"

    const client = await createClient()
    expect(client.baseUrl).toBe("http://localhost:3000")
  })
})

describe("client.callTool()", () => {
  let savedApiKey: string | undefined

  beforeEach(() => {
    savedApiKey = process.env.OUTLIT_API_KEY
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
  })

  afterEach(() => {
    if (savedApiKey !== undefined) {
      process.env.OUTLIT_API_KEY = savedApiKey
    } else {
      Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    }
  })

  test("sends GET with query params for list endpoints", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const mockData = { items: [{ id: "1", name: "Acme" }], pagination: { hasMore: false } }
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const client = await createClient()
    const result = await client.callTool("outlit_list_customers", { limit: 10 })
    expect(result).toEqual(mockData)

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/internal/mcp/customers")
    expect(calledUrl).toContain("limit=10")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe("GET")
    expect(opts.body).toBeUndefined()

    fetchSpy.mockRestore()
  })

  test("sends POST with JSON body for detail endpoints", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const mockData = { customer: { id: "1", name: "Acme" } }
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const client = await createClient()
    const result = await client.callTool("outlit_get_customer", {
      customer: "acme.com",
      include: ["users", "revenue"],
    })
    expect(result).toEqual(mockData)

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/internal/mcp/customers")
    expect(calledUrl).not.toContain("?") // POST — no query params

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe("POST")
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body.customer).toBe("acme.com")
    expect(body.include).toEqual(["users", "revenue"])

    fetchSpy.mockRestore()
  })

  test("includes Authorization header with Bearer token", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_list_customers", {})

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)

    fetchSpy.mockRestore()
  })

  test("throws on HTTP error response", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    )

    const client = await createClient()
    await expect(client.callTool("outlit_list_customers", {})).rejects.toThrow("API error (401)")
    fetchSpy.mockRestore()
  })

  test("throws on unknown tool name", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    await expect(client.callTool("nonexistent_tool", {})).rejects.toThrow("Unknown tool")
  })

  test("skips null/undefined params in GET query string", async () => {
    const { createClient } = await import("../../src/lib/client")
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_list_customers", {
      limit: 10,
      search: null,
      cursor: undefined,
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("limit=10")
    expect(calledUrl).not.toContain("search")
    expect(calledUrl).not.toContain("cursor")

    fetchSpy.mockRestore()
  })
})
