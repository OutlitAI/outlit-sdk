import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(
  async (_toolName: string, _params: unknown): Promise<unknown> => ({
    source: { sourceType: "CALL", sourceId: "call_123" },
  }),
)

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("sources get", () => {
  useTempEnv("sources-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends canonical source lookup to outlit_get_source", async () => {
    const { default: sourcesGetCmd } = await import("../../src/commands/sources/get")

    await captureStdout(() =>
      sourcesGetCmd.run!({
        args: {
          "source-type": "CALL",
          "source-id": "call_123",
          json: true,
        },
      } as Parameters<NonNullable<typeof sourcesGetCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_source", {
      sourceType: "CALL",
      sourceId: "call_123",
    })
  })

  test("normalizes CRM source aliases before lookup", async () => {
    const { default: sourcesGetCmd } = await import("../../src/commands/sources/get")

    await captureStdout(() =>
      sourcesGetCmd.run!({
        args: {
          "source-type": "CRM_OPPORTUNITY",
          "source-id": "opp_123",
          json: true,
        },
      } as Parameters<NonNullable<typeof sourcesGetCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_source", {
      sourceType: "OPPORTUNITY",
      sourceId: "opp_123",
    })
  })

  test("normalizes direct CRM source alias before lookup", async () => {
    const { default: sourcesGetCmd } = await import("../../src/commands/sources/get")

    await captureStdout(() =>
      sourcesGetCmd.run!({
        args: {
          "source-type": "CRM",
          "source-id": "opp_456",
          json: true,
        },
      } as Parameters<NonNullable<typeof sourcesGetCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_source", {
      sourceType: "OPPORTUNITY",
      sourceId: "opp_456",
    })
  })

  test("normalizes case-insensitive CRM source aliases before lookup", async () => {
    const { default: sourcesGetCmd } = await import("../../src/commands/sources/get")

    await captureStdout(() =>
      sourcesGetCmd.run!({
        args: {
          "source-type": " crm ",
          "source-id": "opp_789",
          json: true,
        },
      } as Parameters<NonNullable<typeof sourcesGetCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_source", {
      sourceType: "OPPORTUNITY",
      sourceId: "opp_789",
    })
  })
})

describe("sources list", () => {
  useTempEnv("sources-list-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends source listing filters to outlit_list_sources", async () => {
    const { default: sourcesListCmd } = await import("../../src/commands/sources/list")

    await captureStdout(() =>
      sourcesListCmd.run!({
        args: {
          customer: "acme.com",
          "source-type": " call ",
          participant: "buyer@acme.com",
          provider: "gong",
          "has-transcript": true,
          after: "2025-01-01T00:00:00Z",
          before: "2025-03-31T23:59:59Z",
          limit: "25",
          cursor: "cursor_123",
          json: true,
        },
      } as Parameters<NonNullable<typeof sourcesListCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_sources", {
      customer: "acme.com",
      sourceType: "CALL",
      participant: "buyer@acme.com",
      provider: "gong",
      hasTranscript: true,
      after: "2025-01-01T00:00:00Z",
      before: "2025-03-31T23:59:59Z",
      limit: 25,
      cursor: "cursor_123",
    })
  })

  test("rejects non-UTC datetime filters before calling the API", async () => {
    const { default: sourcesListCmd } = await import("../../src/commands/sources/list")

    await runExpectingError(
      () =>
        sourcesListCmd.run!({
          args: {
            after: "2025-01-01",
            json: true,
          },
        } as Parameters<NonNullable<typeof sourcesListCmd.run>>[0]),
      "invalid_input",
    )

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("renders TTY pagination without requiring a total", async () => {
    const { default: sourcesListCmd } = await import("../../src/commands/sources/list")
    mockCallTool.mockImplementationOnce(async () => ({
      items: [
        {
          sourceType: "CALL",
          sourceId: "call_123",
          occurredAt: "2026-03-12T18:30:00.000Z",
          title: "QBR",
        },
      ],
      pagination: {
        hasMore: true,
        nextCursor: "cursor_next",
      },
    }))
    setInteractive()
    const logSpy = spyOn(console, "log").mockImplementation(() => {})

    try {
      await sourcesListCmd.run!({
        args: {
          json: false,
        },
      } as Parameters<NonNullable<typeof sourcesListCmd.run>>[0])

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n")
      expect(output).toContain("Next page: --cursor cursor_next")
      expect(output).not.toContain("undefined")
    } finally {
      setNonInteractive()
      logSpy.mockRestore()
    }
  })
})
