import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [{ id: "1", name: "Acme", domain: "acme.com", billingStatus: "PAYING" }],
  pagination: { hasMore: false, nextCursor: null, total: 1 },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers list", () => {
  useTempEnv("list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("calls outlit_list_customers with billingStatus when --billing-status is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "billing-status": "PAYING", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ billingStatus: "PAYING" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes mrrAbove as number when --mrr-above is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "mrr-above": "10000", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ mrrAbove: 10000 }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes noActivityInLast when --no-activity-in is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "no-activity-in": "30d", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ noActivityInLast: "30d" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("outputs JSON result to stdout", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
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

  test("auto-outputs JSON when non-interactive (no --json flag)", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      // setNonInteractive() is called in beforeEach, so no --json needed
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

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (401): Unauthorized")
    })

    const { default: listCmd } = await import("../../../src/commands/customers/list")
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

  test("renders table with box-drawing characters in interactive mode", async () => {
    setInteractive()
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Name")
      expect(output).toContain("Domain")
      expect(output).toContain("Billing")
      expect(output).toContain("Acme")
      expect(output).toContain("acme.com")
      expect(output).toContain("PAYING")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })
})
