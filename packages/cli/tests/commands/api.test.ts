import { describe, expect, mock, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { OutlitToolsApiError } from "@outlit/tools"
import {
  ExitError,
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
} from "../helpers"

const mockCallTool = mock(
  async (_toolName: string, _params: unknown): Promise<unknown> => ({ result: "ok" }),
)
const mockCreateClient = mock(async (_apiKey?: string) => ({ callTool: mockCallTool }))

mock.module("../../src/lib/client", () => ({
  createClient: mockCreateClient,
}))

describe("getClientOrExit()", () => {
  test("uses the Core-owned API-key validation transport", () => {
    const source = readFileSync(new URL("../../src/lib/api.ts", import.meta.url), "utf8")

    expect(source).toContain("apiKeyValidationTransport")
    expect(source).not.toContain('new URL("/api/validate-api-key"')
    expect(source).not.toContain('method: "POST"')
  })

  test("returns client when auth succeeds", async () => {
    const { getClientOrExit } = await import("../../src/lib/api")
    const exitSpy = mockExitThrow()
    let client: Awaited<ReturnType<typeof getClientOrExit>> | undefined
    try {
      client = await getClientOrExit(TEST_API_KEY, false)
    } finally {
      exitSpy.mockRestore()
    }
    expect(client).toBeDefined()
    expect(typeof client?.callTool).toBe("function")
  })

  test("exits with auth_required when createClient rejects", async () => {
    mockCreateClient.mockRejectedValueOnce(new Error("invalid key"))
    const { getClientOrExit } = await import("../../src/lib/api")
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let thrown: unknown
    let written = ""
    try {
      await getClientOrExit(`ok_${"b".repeat(32)}`, true)
    } catch (e) {
      thrown = e
    } finally {
      written = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }
    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.code).toBe("auth_required")
  })
})

describe("runTool()", () => {
  test("outputs the tool result as JSON", async () => {
    mockCallTool.mockResolvedValueOnce({ items: [{ id: "1" }] })
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, true)
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let written = ""
    try {
      await runTool(client, "outlit_query", { sql: "SELECT 1" }, true)
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      exitSpy.mockRestore()
    }
    expect(JSON.parse(written)).toMatchObject({ items: [{ id: "1" }] })
  })

  test("exits with api_error when callTool throws", async () => {
    mockCallTool.mockRejectedValueOnce(new Error("timeout"))
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let thrown: unknown
    let written = ""
    try {
      await runTool(client, "outlit_query", { sql: "SELECT 1" }, true)
    } catch (e) {
      thrown = e
    } finally {
      written = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }
    expectErrorExit(thrown, written, "api_error")
  })

  test("preserves gateway error envelopes in JSON mode", async () => {
    const gatewayEnvelope = {
      code: "TOOL_CALL_FORBIDDEN" as const,
      message: "API key is missing the required grant.",
      requestId: "request_denied_123",
      retryable: false,
    }
    const error = new OutlitToolsApiError(403, JSON.stringify(gatewayEnvelope), gatewayEnvelope)
    mockCallTool.mockRejectedValueOnce(error)

    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let thrown: unknown
    let written = ""
    try {
      await runTool(client, "outlit_update_settings", { timezone: "America/Los_Angeles" }, true)
    } catch (e) {
      thrown = e
    } finally {
      written = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(JSON.parse(written)).toEqual(gatewayEnvelope)
  })

  test("does not write spinner output around a JSON gateway error on an interactive TTY", async () => {
    const gatewayEnvelope = {
      code: "TOOL_CALL_FORBIDDEN" as const,
      message: "API key is missing the required grant.",
      requestId: "request_denied_tty_123",
      retryable: false,
    }
    mockCallTool.mockRejectedValueOnce(
      new OutlitToolsApiError(403, JSON.stringify(gatewayEnvelope), gatewayEnvelope),
    )
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    setInteractive()
    let written = ""
    try {
      await runTool(client, "outlit_list_integrations", {}, true, {
        spinnerMessage: "Loading integration status...",
      })
    } catch {
      written = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
    } finally {
      setNonInteractive()
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(JSON.parse(written)).toEqual(gatewayEnvelope)
  })

  test("renders table rows from the tool's collection key", async () => {
    mockCallTool.mockResolvedValueOnce({
      items: [{ id: "dest_123", label: "#customer-ops" }],
    })
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)
    const logSpy = spyOn(console, "log").mockImplementation(() => {})

    setInteractive()
    try {
      await runTool(client, "outlit_list_destinations", {}, false, {
        table: {
          columns: [
            { header: "ID", key: "id" },
            { header: "Label", key: "label" },
          ],
        },
      })

      const output = logSpy.mock.calls.map((call) => call[0] as string).join("\n")
      expect(output).toContain("dest_123")
      expect(output).toContain("#customer-ops")
    } finally {
      setNonInteractive()
      logSpy.mockRestore()
    }
  })
  test("prints validation issues, the retry interval and the missing permission on a terminal", async () => {
    const envelope = {
      code: "INVALID_TOOL_INPUT" as const,
      message: "Invalid input",
      requestId: "request_terminal_1",
      retryable: false,
      validationIssues: [
        { code: "too_big", path: "limit", message: "limit is at most 100" },
        {
          code: "invalid_value",
          path: "filters.billingStatus",
          validValues: ["paying", "trialing"],
        },
        { code: "custom", path: "" },
      ],
    }
    const rate = {
      code: "TOOL_IMPLEMENTATION_ERROR" as const,
      message: "Too many requests",
      requestId: "request_terminal_2",
      retryable: true,
      retryAfterSeconds: 12,
    }
    const forbidden = {
      code: "TOOL_CALL_FORBIDDEN" as const,
      message: "Capability not authorized",
      requestId: "request_terminal_3",
      retryable: false,
      missingPermission: "destinations:read",
    }
    const quota = {
      code: "plan_api_limit_exceeded" as const,
      message: "API call limit exceeded",
      requestId: "request_terminal_4",
      retryable: false,
      resetsAt: "2026-12-01T00:00:00.000Z",
    }
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)

    const printed: string[] = []
    for (const [status, body] of [
      [400, envelope],
      [429, rate],
      [403, forbidden],
      [429, quota],
    ] as const) {
      mockCallTool.mockRejectedValueOnce(
        new OutlitToolsApiError(status, JSON.stringify(body), body),
      )
      const errorSpy = spyOn(console, "error").mockImplementation(() => {})
      const exitSpy = mockExitThrow()
      setInteractive()
      try {
        await runTool(client, "outlit_list_customers", {}, false).catch(() => {})
        printed.push(errorSpy.mock.calls.map((call) => call[0] as string).join("\n"))
      } finally {
        setNonInteractive()
        errorSpy.mockRestore()
        exitSpy.mockRestore()
      }
    }

    expect(printed[0]).toBe(
      [
        "Error: Invalid input",
        "  limit: limit is at most 100",
        "  filters.billingStatus: invalid_value (one of: paying, trialing)",
        "  input: custom",
      ].join("\n"),
    )
    expect(printed[1]).toBe("Error: Too many requests\nRetry in 12s.")
    expect(printed[2]).toBe(
      "Error: Capability not authorized\nMissing permission: destinations:read",
    )
    expect(printed[3]).toBe(
      "Error: API call limit exceeded\nPlan API call limit reached. Resets at 2026-12-01T00:00:00.000Z; retrying before then will fail.",
    )
  })

  test("shows a table column only when some row has a value, and says who a call could not rank", async () => {
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)
    const table = {
      columns: [
        { header: "Name", key: "name" },
        { header: "Credits", key: "credits", optional: true },
      ],
    }
    const run = async (data: unknown) => {
      mockCallTool.mockResolvedValueOnce(data)
      const logSpy = spyOn(console, "log").mockImplementation(() => {})
      setInteractive()
      try {
        await runTool(client, "outlit_list_customers", {}, false, { table })
        return logSpy.mock.calls.map((call) => call[0] as string).join("\n")
      } finally {
        setNonInteractive()
        logSpy.mockRestore()
      }
    }

    const without = await run({ items: [{ name: "Acme" }], page: { hasMore: false } })
    expect(without).toContain("Acme")
    expect(without).not.toContain("Credits")

    const withCredits = await run({
      items: [{ name: "Acme", credits: "runs out 2026-12-01" }, { name: "Beta" }],
      page: { hasMore: false },
      coverage: { searched: "customers", stale: 3, withoutMeter: 0, ambiguous: 1 },
    })
    expect(withCredits).toContain("Credits")
    expect(withCredits).toContain("runs out 2026-12-01")
    expect(withCredits).toContain(
      "Not listed: 3 left out: Autumn scan over 3 hours old; 1 left out: email matches several Autumn accounts.",
    )
  })

  test("renders a list from the tool's own collection key and says when the gateway cut it", async () => {
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)
    mockCallTool.mockResolvedValueOnce({
      customer: { id: "cust_1" },
      events: [{ id: "evt_1", title: "Call with Acme" }],
      page: { hasMore: true, nextCursor: "cur_2", total: null },
      truncation: {
        truncated: true,
        reason: "byte_cap",
        returned: 1,
        next: {
          instruction: "Read the rest",
          tool: "outlit_get_timeline",
          input: { customer: "cust_1", cursor: "cur_2" },
        },
      },
    })
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    setInteractive()
    try {
      await runTool(client, "outlit_get_timeline", { customer: "cust_1" }, false, {
        table: {
          columns: [
            { header: "ID", key: "id" },
            { header: "Title", key: "title" },
          ],
        },
      })
      const output = logSpy.mock.calls.map((call) => call[0] as string).join("\n")
      expect(output).toContain("Call with Acme")
      expect(output).toContain("Next page: --cursor cur_2")
      expect(output).toContain(
        "Cut to fit the response size: 1 rows kept. outlit timeline get cust_1 --cursor cur_2",
      )
    } finally {
      setNonInteractive()
      logSpy.mockRestore()
    }
  })

  test("prints the command that reads each part a result only holds the first of", async () => {
    mockCallTool.mockResolvedValueOnce({
      customer: { id: "cust_1", name: "Acme" },
      users: {
        status: "available",
        asOf: "2026-11-10T00:00:00Z",
        data: [],
        more: {
          omitted: 12,
          next: {
            instruction: "All 22 people, a page at a time",
            tool: "outlit_list_people",
            input: { customer: "cust_1", limit: 10 },
          },
        },
      },
    })
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    setInteractive()
    try {
      await runTool(client, "outlit_get_customer", { customer: "acme.com" }, false)
      expect(stderrSpy.mock.calls.map((call) => call[0] as string)).toEqual([
        "users: 12 more: outlit people list --customer cust_1 --limit 10\n",
      ])
    } finally {
      setNonInteractive()
      writeSpy.mockRestore()
      stderrSpy.mockRestore()
    }
  })
})
