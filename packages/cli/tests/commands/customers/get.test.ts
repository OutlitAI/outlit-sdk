import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  id: "1",
  name: "Acme Corp",
  domain: "acme.com",
  billingStatus: "PAYING",
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers get", () => {
  useTempEnv("get-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("passes positional customer arg to API", async () => {
    const { default: getCmd } = await import("../../../src/commands/customers/get")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await getCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0])
      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_customer",
        expect.objectContaining({ customer: "acme.com" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("splits --include on comma and passes as array", async () => {
    const { default: getCmd } = await import("../../../src/commands/customers/get")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await getCmd.run!({
        args: { customer: "acme.com", include: "users,revenue", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0])
      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_customer",
        expect.objectContaining({ include: ["users", "revenue"] }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes timeframe arg to API", async () => {
    const { default: getCmd } = await import("../../../src/commands/customers/get")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await getCmd.run!({
        args: { customer: "acme.com", timeframe: "90d", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0])
      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_customer",
        expect.objectContaining({ timeframe: "90d" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("outputs JSON result to stdout", async () => {
    const { default: getCmd } = await import("../../../src/commands/customers/get")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await getCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0])
      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      expect(parsed.domain).toBe("acme.com")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (404): Not Found")
    })
    const { default: getCmd } = await import("../../../src/commands/customers/get")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    let thrown: unknown
    let stderrWritten = ""
    try {
      await getCmd.run!({
        args: { customer: "unknown.com", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0])
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
