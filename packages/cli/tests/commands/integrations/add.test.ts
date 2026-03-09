import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  sessionId: "sess_123",
  connectUrl: "https://connect.example.com/auth",
  alreadyConnected: false,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations add", () => {
  useTempEnv("integrations-add-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("rejects unknown provider", async () => {
    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await addCmd.run!({
        args: { provider: "unknown-thing", json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "unknown_provider")
  })

  test("calls outlit_connect_integration with correct provider id", async () => {
    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await addCmd.run!({
        args: { provider: "salesforce", json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "salesforce",
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("resolves gmail alias to google-mail", async () => {
    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await addCmd.run!({
        args: { provider: "gmail", json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "google-mail",
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("returns already_connected status without --force", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      sessionId: "sess_123",
      connectUrl: "https://connect.example.com/auth",
      alreadyConnected: true,
    }))

    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await addCmd.run!({
        args: { provider: "salesforce", json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      expect(parsed.status).toBe("already_connected")
    } finally {
      writeSpy.mockRestore()
      logSpy.mockRestore()
    }
  })

  test("proceeds when already connected with --force", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      sessionId: "sess_123",
      connectUrl: "https://connect.example.com/auth",
      alreadyConnected: true,
    }))

    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await addCmd.run!({
        args: { provider: "salesforce", force: true, json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      // Should return awaiting_auth, not already_connected
      expect(parsed.status).toBe("awaiting_auth")
      expect(parsed.connectUrl).toBe("https://connect.example.com/auth")
      expect(parsed.sessionId).toBe("sess_123")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("returns awaiting_auth with connect data in JSON mode", async () => {
    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await addCmd.run!({
        args: { provider: "slack", json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      expect(parsed.status).toBe("awaiting_auth")
      expect(parsed.provider).toBe("slack")
      expect(parsed.sessionId).toBe("sess_123")
      expect(parsed.connectUrl).toBeString()
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (500): Internal Server Error")
    })

    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await addCmd.run!({
        args: { provider: "salesforce", json: true },
      } as Parameters<NonNullable<typeof addCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "api_error")
  })
})
