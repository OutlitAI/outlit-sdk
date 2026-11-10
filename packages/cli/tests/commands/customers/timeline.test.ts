import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  events: [],
  page: { hasMore: false, nextCursor: null, total: 0 },
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

  test("sends the timeframe as filters.within when no dates are provided", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_timeline", {
        customer: "acme.com",
        filters: { within: "30d" },
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("sends --start-date as filters.after and drops the timeframe", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", "start-date": "2025-01-01", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_timeline", {
        customer: "acme.com",
        filters: { after: "2025-01-01" },
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("sends --start-date and --end-date as filters.after and filters.before", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: {
          customer: "acme.com",
          "start-date": "2025-01-01T00:00:00Z",
          "end-date": "2025-03-01T23:59:59.999Z",
          timeframe: "30d",
          json: true,
        },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_timeline", {
        customer: "acme.com",
        filters: { after: "2025-01-01T00:00:00Z", before: "2025-03-01T23:59:59.999Z" },
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("counts --timeframe back from --end-date as within plus before", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: { customer: "acme.com", "end-date": "2025-03-01", timeframe: "90D", json: true },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_timeline", {
        customer: "acme.com",
        filters: { within: "90d", before: "2025-03-01" },
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("sends lowercase filters.channels and filters.eventTypes for any input case", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: {
          customer: "acme.com",
          channels: "COMMUNICATION,meeting",
          "event-types": "NOTE_ADDED,email_received",
          timeframe: "30d",
          json: true,
        },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_timeline", {
        customer: "acme.com",
        filters: {
          within: "30d",
          channels: ["communication", "meeting"],
          eventTypes: ["note_added", "email_received"],
        },
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("maps the old channel names to the current lowercase ones", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: {
          customer: "acme.com",
          channels: "EMAIL,SLACK,CALENDAR,SDK",
          timeframe: "30d",
          json: true,
        },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_timeline",
        expect.objectContaining({
          filters: expect.objectContaining({
            channels: ["communication", "meeting", "product"],
          }),
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("drops empty --channels tokens", async () => {
    const { default: timelineCmd } = await import("../../../src/commands/customers/timeline")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await timelineCmd.run!({
        args: {
          customer: "acme.com",
          channels: "communication,,meeting,",
          timeframe: "30d",
          json: true,
        },
      } as Parameters<NonNullable<typeof timelineCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_timeline",
        expect.objectContaining({
          filters: expect.objectContaining({ channels: ["communication", "meeting"] }),
        }),
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
