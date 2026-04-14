import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [],
  pagination: { hasMore: false, nextCursor: null, total: 0 },
}))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("facts commands", () => {
  useTempEnv("facts-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("list sends customer filters to outlit_list_facts", async () => {
    const { default: factsListCmd } = await import("../../src/commands/facts/list")

    await captureStdout(() =>
      factsListCmd.run!({
        args: {
          customer: "acme.com",
          status: "ACTIVE",
          "source-types": "CALL,EMAIL",
          "fact-types": "CHURN_RISK,EXPANSION",
          "fact-categories": "MEMORY",
          after: "2025-01-01T00:00:00Z",
          before: "2025-03-31T23:59:59Z",
          limit: "50",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsListCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith(
      "outlit_list_facts",
      expect.objectContaining({
        customer: "acme.com",
        status: ["ACTIVE"],
        sourceTypes: ["CALL", "EMAIL"],
        factTypes: ["CHURN_RISK", "EXPANSION"],
        factCategories: ["MEMORY"],
        after: "2025-01-01T00:00:00Z",
        before: "2025-03-31T23:59:59Z",
        limit: 50,
      }),
    )
  })

  test("list rejects invalid date range", async () => {
    const { default: factsListCmd } = await import("../../src/commands/facts/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await factsListCmd.run!({
        args: {
          customer: "acme.com",
          after: "2025-04-01T00:00:00Z",
          before: "2025-03-01T23:59:59Z",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsListCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("list rejects malformed ISO datetimes", async () => {
    const { default: factsListCmd } = await import("../../src/commands/facts/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await factsListCmd.run!({
        args: {
          customer: "acme.com",
          after: "not-a-date",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsListCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(stderrOutput).toContain("--after must be a valid ISO 8601 datetime")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("list rejects anomaly detector fact type filters", async () => {
    const { default: factsListCmd } = await import("../../src/commands/facts/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await factsListCmd.run!({
        args: {
          customer: "acme.com",
          "fact-types": "CORE_ACTION_DECAY",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsListCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(stderrOutput).toContain("Anomaly detector fact types are not supported")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("list reports anomaly and unknown fact type filters together", async () => {
    const { default: factsListCmd } = await import("../../src/commands/facts/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await factsListCmd.run!({
        args: {
          customer: "acme.com",
          "fact-types": "CORE_ACTION_DECAY,NOT_A_FACT",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsListCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(stderrOutput).toContain("Anomaly detector fact types are not supported")
      expect(stderrOutput).toContain("CORE_ACTION_DECAY")
      expect(stderrOutput).toContain("Unknown fact types: NOT_A_FACT")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("list rejects internal anomaly fact category filters", async () => {
    const { default: factsListCmd } = await import("../../src/commands/facts/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await factsListCmd.run!({
        args: {
          customer: "acme.com",
          "fact-categories": "CHURN",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsListCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(stderrOutput).toContain("Unsupported fact categories")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("get sends fact id and include list to outlit_get_fact", async () => {
    const { default: factsGetCmd } = await import("../../src/commands/facts/get")

    await captureStdout(() =>
      factsGetCmd.run!({
        args: {
          "fact-id": "fact_123",
          include: "evidence,ignored",
          json: true,
        },
      } as Parameters<NonNullable<typeof factsGetCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_fact", {
      factId: "fact_123",
      include: ["evidence", "ignored"],
    })
  })
})
