import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { cliToolNames, toolGatewayTransport } from "@outlit/tools"
import { createClient } from "../../src/lib/client"
import { CLI_CLIENT } from "../../src/lib/client-id"
import { TEST_API_KEY } from "../helpers"

describe("CLI_CLIENT", () => {
  test("is the package name and its own version, as sent in x-outlit-client", () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dir, "..", "..", "package.json"), "utf8"),
    ) as { name: string; version: string }

    expect(CLI_CLIENT).toBe(`${pkg.name}/${pkg.version}`)
  })
})

describe("createClient", () => {
  let savedApiKey: string | undefined
  let savedApiUrl: string | undefined
  let savedXdg: string | undefined

  beforeEach(() => {
    savedApiKey = process.env.OUTLIT_API_KEY
    savedApiUrl = process.env.OUTLIT_API_URL
    savedXdg = process.env.XDG_CONFIG_HOME
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    Reflect.deleteProperty(process.env, "OUTLIT_API_URL")
    process.env.XDG_CONFIG_HOME = "/tmp/outlit-test-no-config"
  })

  afterEach(() => {
    restoreEnv("OUTLIT_API_KEY", savedApiKey)
    restoreEnv("OUTLIT_API_URL", savedApiUrl)
    restoreEnv("XDG_CONFIG_HOME", savedXdg)
  })

  test("requires a valid API key", async () => {
    await expect(createClient()).rejects.toThrow("No API key found")
    process.env.OUTLIT_API_KEY = "ok_short"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("rejects non-HTTPS non-loopback API origins before creating a client", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.OUTLIT_API_URL = "http://api.example.com"

    await expect(createClient()).rejects.toThrow(
      "OUTLIT_API_URL must use HTTPS unless it is a loopback development URL",
    )
  })

  test.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("allows loopback development origin %s", async (baseUrl) => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.OUTLIT_API_URL = baseUrl

    const client = await createClient()

    expect(client.baseUrl).toBe(baseUrl)
  })

  test("routes every Core-owned CLI capability through the generated gateway transport", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.OUTLIT_API_URL = "https://example.outlit.test"
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      (async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch,
    )
    const client = await createClient()

    for (const toolName of cliToolNames) {
      await client.callTool(toolName, {})
    }

    expect(fetchSpy).toHaveBeenCalledTimes(cliToolNames.length)
    for (const [url, init] of fetchSpy.mock.calls) {
      expect(url).toBe(`https://example.outlit.test${toolGatewayTransport.path}`)
      expect(init?.method).toBe(toolGatewayTransport.method)
      expect(init?.headers).toEqual({
        Authorization: `Bearer ${TEST_API_KEY}`,
        "Content-Type": "application/json",
        "x-outlit-client": CLI_CLIENT,
      })
    }
    fetchSpy.mockRestore()
  })

  test("preserves tool input in the gateway body", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ integrations: [] }), { status: 200 }),
    )
    const client = await createClient()
    await client.callTool("outlit_list_integrations", { provider: "slack" })

    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      tool: "outlit_list_integrations",
      input: { provider: "slack" },
    })
    fetchSpy.mockRestore()
  })

  test("rejects undeclared and retired tools before transport", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch")
    const client = await createClient()

    // @ts-expect-error retired setup-step capability is absent from the generated CLI policy
    await expect(client.callTool("outlit_integration_setup_step", {})).rejects.toThrow(
      "Unknown CLI tool",
    )
    // @ts-expect-error retired notification capability is absent from the generated CLI policy
    await expect(client.callTool("outlit_send_notification", {})).rejects.toThrow(
      "Unknown CLI tool",
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  test("prints the gateway's deprecation and notices to stderr, leaving the result alone", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: {
          "outlit-deprecation": JSON.stringify({
            tool: "outlit_list_users",
            use: "outlit_list_people",
            until: "2026-12-11",
            message: "outlit_list_users is deprecated: use outlit_list_people.",
          }),
          "outlit-notice": JSON.stringify(["limit 500 was lowered to 100."]),
        },
      }),
    )
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const client = await createClient()

    try {
      await expect(client.callTool("outlit_list_people", {})).resolves.toEqual({ items: [] })
      expect(stderrSpy.mock.calls.map((call) => call[0])).toEqual([
        "Warning: outlit_list_users is deprecated: use outlit_list_people. (until 2026-12-11)\n",
        "Note: limit 500 was lowered to 100.\n",
      ])
    } finally {
      stderrSpy.mockRestore()
      fetchSpy.mockRestore()
    }
  })

  test("writes nothing to stderr for a response without notices", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const client = await createClient()

    try {
      await client.callTool("outlit_list_people", {})
      expect(stderrSpy).not.toHaveBeenCalled()
    } finally {
      stderrSpy.mockRestore()
      fetchSpy.mockRestore()
    }
  })

  test("surfaces the stable gateway error envelope", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "TOOL_CALL_FORBIDDEN",
          message: "API key is missing a required grant.",
          retryable: false,
          requestId: "request_123",
        }),
        { status: 403 },
      ),
    )
    const client = await createClient()

    await expect(client.callTool("outlit_update_settings", {})).rejects.toThrow(
      "API key is missing a required grant.",
    )
    fetchSpy.mockRestore()
  })
})

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name)
  else process.env[name] = value
}
