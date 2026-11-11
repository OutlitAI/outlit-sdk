import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  expectErrorExit,
  mockExitThrow,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  results: [],
  coverage: { searched: "emails, calls and facts" },
}))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("search", () => {
  useTempEnv("search-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends query, limit, and filters with lowercase source types", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")

    await captureStdout(() =>
      searchCmd.run!({
        args: {
          query: "pricing objections",
          customer: "acme.com",
          limit: "10",
          after: "2025-01-01T00:00:00Z",
          before: "2025-03-31T23:59:59Z",
          "source-types": "CALL,CRM",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_search_customer_context", {
      query: "pricing objections",
      customer: "acme.com",
      limit: 10,
      filters: {
        after: "2025-01-01T00:00:00Z",
        before: "2025-03-31T23:59:59Z",
        sourceTypes: ["call", "opportunity"],
      },
    })
  })

  test("still accepts --top-k, the previous spelling of --limit", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")

    await captureStdout(() =>
      searchCmd.run!({
        args: { query: "pricing", json: true },
        rawArgs: ["pricing", "--top-k", "7", "--json"],
      } as Parameters<NonNullable<typeof searchCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_search_customer_context", {
      query: "pricing",
      limit: 7,
    })
  })

  test("rejects the STRIPE_INVOICE source filter, which only the source tools accept", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")

    await runExpectingError(async () => {
      await searchCmd.run!({
        args: { query: "invoices", "source-types": "stripe_invoice", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    }, "invalid_input")

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("normalizes case-insensitive CRM opportunity source filters", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")

    await captureStdout(() =>
      searchCmd.run!({
        args: {
          query: "renewal risks",
          "source-types": " call ,crm_opportunity, opportunity ",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_search_customer_context", {
      query: "renewal risks",
      filters: { sourceTypes: ["call", "opportunity"] },
    })
  })

  test("error when --limit exceeds the contract maximum of 100", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: { query: "test", limit: "101", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
    }
  })

  test("accepts a --limit up to the contract maximum of 100", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")

    await captureStdout(() =>
      searchCmd.run!({
        args: { query: "pricing", limit: "100", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_search_customer_context", {
      query: "pricing",
      limit: 100,
    })
  })

  test("error when query is missing", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: { limit: "20", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
    }
  })

  test("error when date range is inverted", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: {
          query: "pricing",
          after: "2025-04-01T00:00:00Z",
          before: "2025-03-01T23:59:59Z",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
    }
  })

  test("auth_required error — createClient throws → outputError called", async () => {
    const clientModule = await import("../../src/lib/client")
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY."),
    )
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: { query: "pricing", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      createClientSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "auth_required")
    }
  })
})
