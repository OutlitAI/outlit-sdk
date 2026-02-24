import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
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
        args: { query: "test query", json: true },
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
