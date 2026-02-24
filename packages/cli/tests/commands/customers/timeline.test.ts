import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [],
  pagination: { hasMore: false, nextCursor: null, total: 0 },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("customers timeline", () => {
  useTempEnv("timeline-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends timeframe when no dates provided", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_timeline",
        expect.objectContaining({ timeframe: "30d" }),
      )
      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).not.toHaveProperty("startDate")
      expect(params).not.toHaveProperty("endDate")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("omits timeframe when --start-date provided", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", "start-date": "2025-01-01", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).toHaveProperty("startDate", "2025-01-01")
      expect(params).not.toHaveProperty("timeframe")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("omits timeframe when --end-date provided", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", "end-date": "2025-03-01", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).toHaveProperty("endDate", "2025-03-01")
      expect(params).not.toHaveProperty("timeframe")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("splits --channels on comma", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", channels: "EMAIL,SLACK", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_timeline",
        expect.objectContaining({ channels: ["EMAIL", "SLACK"] }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("auth_required error — createClient throws → outputError called", async () => {
    const clientModule = await import("../../../src/lib/client")
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY."),
    )
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      createClientSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "auth_required")
    }
  })
})
