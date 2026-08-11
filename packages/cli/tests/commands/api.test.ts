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
      await runTool(
        client,
        "outlit_update_workspace_settings",
        { defaultTimezone: "America/Los_Angeles" },
        true,
      )
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
      await runTool(client, "outlit_get_integration_status", {}, true, {
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

  test("renders table rows from nested response paths", async () => {
    mockCallTool.mockResolvedValueOnce({
      destinations: [{ id: "dest_123", label: "#customer-ops" }],
    })
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)
    const logSpy = spyOn(console, "log").mockImplementation(() => {})

    setInteractive()
    try {
      await runTool(client, "outlit_list_destinations", {}, false, {
        table: {
          itemsKey: "destinations",
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
})
