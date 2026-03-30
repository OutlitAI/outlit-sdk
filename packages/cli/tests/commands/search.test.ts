import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [],
  total: 0,
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

  test("sends query and topK", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await searchCmd.run!({
        args: { query: "pricing objections", "top-k": "10", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_search_customer_context",
        expect.objectContaining({ query: "pricing objections", topK: 10 }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--after→occurredAfter, --before→occurredBefore", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await searchCmd.run!({
        args: {
          query: "churn signals",
          after: "2025-01-01",
          before: "2025-03-31",
          "top-k": "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_search_customer_context",
        expect.objectContaining({
          occurredAfter: "2025-01-01",
          occurredBefore: "2025-03-31",
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--doc-types splits into array", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await searchCmd.run!({
        args: {
          query: "budget",
          "doc-types": "fact,email_chunk",
          "top-k": "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_search_customer_context",
        expect.objectContaining({
          query: "budget",
          docTypes: ["fact", "email_chunk"],
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--source-types splits into array", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await searchCmd.run!({
        args: {
          query: "onboarding",
          "source-types": "call_transcript,email",
          "top-k": "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_search_customer_context",
        expect.objectContaining({
          query: "onboarding",
          sourceTypes: ["call_transcript", "email"],
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--source-type + --source-id direct lookup without query", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await searchCmd.run!({
        args: {
          "source-type": "call_transcript",
          "source-id": "call_123",
          "top-k": "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_search_customer_context",
        expect.objectContaining({
          sourceType: "call_transcript",
          sourceId: "call_123",
        }),
      )
      // query should not be in params
      const callParams = mockCallTool.mock.calls[0]![1] as Record<string, unknown>
      expect(callParams.query).toBeUndefined()
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("error when neither query nor --source-type/--source-id", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: { "top-k": "20", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
    }
  })

  test("error when --source-type without --source-id", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: { "source-type": "call_transcript", "top-k": "20", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
    }
  })

  test("error when --source-id without --source-type", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: { "source-id": "call_123", "top-k": "20", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
    }
  })

  test("error when --source-types combined with --source-type/--source-id", async () => {
    const { default: searchCmd } = await import("../../src/commands/search")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await searchCmd.run!({
        args: {
          query: "test",
          "source-types": "email",
          "source-type": "call_transcript",
          "source-id": "call_123",
          "top-k": "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
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
        args: { query: "test query", "top-k": "20", json: true },
      } as Parameters<NonNullable<typeof searchCmd.run>>[0])
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
