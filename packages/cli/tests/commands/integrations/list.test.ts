import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [
    { name: "Salesforce", category: "crm", status: "connected", lastDataReceivedAt: null },
    { name: "Slack", category: "communication", status: "not_connected", lastDataReceivedAt: null },
  ],
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations list", () => {
  useTempEnv("integrations-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("calls outlit_list_integrations", async () => {
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_list_integrations", {})
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("outputs JSON result to stdout", async () => {
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      expect(Array.isArray(parsed.items)).toBe(true)
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("auto-outputs JSON when non-interactive", async () => {
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(writeSpy).toHaveBeenCalled()
      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      expect(() => JSON.parse(written)).not.toThrow()
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("renders table in interactive mode", async () => {
    setInteractive()
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Name")
      expect(output).toContain("Category")
      expect(output).toContain("Status")
      expect(output).toContain("Salesforce")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (401): Unauthorized")
    })

    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
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
