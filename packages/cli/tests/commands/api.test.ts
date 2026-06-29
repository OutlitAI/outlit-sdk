import { describe, expect, mock, spyOn, test } from "bun:test"
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

  test("preserves platform command error envelopes in JSON mode", async () => {
    const commandEnvelope = {
      ok: false,
      commandId: "agent.create",
      commandVersion: 1,
      error: {
        code: "authorization_denied",
        message: "API key is missing the required agents:write scope.",
        correlationId: "corr_denied_123",
        retryable: false,
        details: { requiredScope: "agents:write" },
      },
    }
    const error = new Error(commandEnvelope.error.message) as Error & {
      status: number
      commandEnvelope: typeof commandEnvelope
    }
    error.status = 403
    error.commandEnvelope = commandEnvelope
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
        "outlit_agent_create",
        { type: "template", templateKey: "churn", mode: "draft" },
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
    expect(JSON.parse(written)).toEqual(commandEnvelope)
  })

  test("renders table rows from nested response paths", async () => {
    mockCallTool.mockResolvedValueOnce({
      ok: true,
      result: {
        data: {
          templates: [{ key: "churn", name: "Churn prevention" }],
        },
      },
    })
    const { getClientOrExit, runTool } = await import("../../src/lib/api")
    const client = await getClientOrExit(TEST_API_KEY, false)
    const logSpy = spyOn(console, "log").mockImplementation(() => {})

    setInteractive()
    try {
      await runTool(client, "outlit_agent_list_templates", {}, false, {
        table: {
          itemsKey: "result.data.templates",
          columns: [
            { header: "Key", key: "key" },
            { header: "Name", key: "name" },
          ],
        },
      })

      const output = logSpy.mock.calls.map((call) => call[0] as string).join("\n")
      expect(output).toContain("churn")
      expect(output).toContain("Churn prevention")
    } finally {
      setNonInteractive()
      logSpy.mockRestore()
    }
  })
})
