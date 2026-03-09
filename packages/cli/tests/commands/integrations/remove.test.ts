import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  success: true,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations remove", () => {
  useTempEnv("integrations-remove-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("rejects unknown provider", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await removeCmd.run!({
        args: { provider: "nonexistent", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "unknown_provider")
  })

  test("requires --yes in non-interactive mode", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await removeCmd.run!({
        args: { provider: "salesforce", json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "confirmation_required")
  })

  test("disconnects with --yes flag", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await removeCmd.run!({
        args: { provider: "salesforce", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_disconnect_integration", {
        provider: "salesforce",
      })

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      expect(parsed.success).toBe(true)
      expect(parsed.provider).toBe("salesforce")
    } finally {
      writeSpy.mockRestore()
      logSpy.mockRestore()
    }
  })

  test("resolves gmail alias to google-mail for disconnect", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await removeCmd.run!({
        args: { provider: "gmail", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_disconnect_integration", {
        provider: "google-mail",
      })
    } finally {
      writeSpy.mockRestore()
      logSpy.mockRestore()
    }
  })

  test("exits 1 when disconnect fails", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      success: false,
      message: "Integration not found",
    }))

    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await removeCmd.run!({
        args: { provider: "salesforce", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "disconnect_failed")
  })

  test("exits 1 when API call throws", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (500): Server Error")
    })

    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await removeCmd.run!({
        args: { provider: "salesforce", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0])
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
