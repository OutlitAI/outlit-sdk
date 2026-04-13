import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { createClient } from "../../src/lib/client"
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
    await expect(createClient()).rejects.toThrow("No API key found")
  })

  test("throws when API key has invalid format", async () => {
    process.env.OUTLIT_API_KEY = "invalid_key_no_ok_prefix"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("throws when API key is too short (prefix only)", async () => {
    process.env.OUTLIT_API_KEY = "ok_short"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("returns client with key and baseUrl when key is valid", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    expect(client.key).toBe(TEST_API_KEY)
    expect(client.baseUrl).toBe("https://app.outlit.ai")
  })

  test("uses OUTLIT_API_URL env var to override base URL", async () => {
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

  test("delegates customer tools to the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const mockData = { items: [{ id: "1", name: "Acme" }], pagination: { hasMore: false } }
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const client = await createClient()
    const result = await client.callTool("outlit_list_customers", { limit: 10 })
    expect(result).toEqual(mockData)

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe("POST")
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_list_customers",
      input: { limit: 10 },
    })

    fetchSpy.mockRestore()
  })

  test("keeps integration tools on public integration endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: "session_123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "connected" }), { status: 200 }))

    const client = await createClient()
    await client.callTool("outlit_list_integrations", { connectedOnly: true })
    await client.callTool("outlit_connect_integration", { provider: "slack" })
    await client.callTool("outlit_connect_status", { sessionId: "session_123" })
    await client.callTool("outlit_disconnect_integration", { provider: "slack" })
    await client.callTool("outlit_integration_sync_status", { provider: "slack" })

    expect(fetchSpy.mock.calls[0]?.[0] as string).toContain("/api/integrations?connectedOnly=true")
    expect(fetchSpy.mock.calls[1]?.[0] as string).toContain("/api/integrations/connect")
    expect(fetchSpy.mock.calls[2]?.[0] as string).toContain(
      "/api/integrations/connect/status?sessionId=session_123",
    )
    expect(fetchSpy.mock.calls[3]?.[0] as string).toContain("/api/integrations/disconnect")
    expect(fetchSpy.mock.calls[4]?.[0] as string).toContain(
      "/api/integrations/sync-status?provider=slack",
    )

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ provider: "slack" }),
    )
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[4]?.[1] as RequestInit).method).toBe("GET")

    fetchSpy.mockRestore()
  })

  test("delegates exact fact retrieval through the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ fact: { id: "fact_123" } }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_get_fact", {
      factId: "fact_123",
      include: ["evidence"],
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_get_fact",
      input: {
        factId: "fact_123",
        include: ["evidence"],
      },
    })

    fetchSpy.mockRestore()
  })

  test("delegates exact source retrieval through the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ source: { sourceType: "CALL" } }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_get_source", {
      sourceType: "CALL",
      sourceId: "call_123",
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    fetchSpy.mockRestore()
  })

  test("includes Authorization header with Bearer token", async () => {
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
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    )

    const client = await createClient()
    await expect(client.callTool("outlit_list_customers", {})).rejects.toThrow("API error (401)")
    fetchSpy.mockRestore()
  })

  test("throws on unknown tool name", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    await expect(client.callTool("nonexistent_tool", {})).rejects.toThrow("Unknown tool")
  })

  test("passes customer tool input through the public tool request body", async () => {
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

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_list_customers",
      input: {
        limit: 10,
        search: null,
        cursor: undefined,
      },
    })

    fetchSpy.mockRestore()
  })

  test("passes object params through customer tool request bodies", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_list_customers", {
      traitFilters: { segment: "enterprise", active: true, seats: 25 },
    })

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_list_customers",
      input: {
        traitFilters: { segment: "enterprise", active: true, seats: 25 },
      },
    })

    fetchSpy.mockRestore()
  })

  test("delegates search through the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_search_customer_context", {
      query: "pricing",
      sourceType: "CALL",
      sourceId: "call_123",
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_search_customer_context",
      input: {
        query: "pricing",
        sourceType: "CALL",
        sourceId: "call_123",
      },
    })

    fetchSpy.mockRestore()
  })
})
