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

describe("facts", () => {
  useTempEnv("facts-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends customer and timeframe", async () => {
    const { default: factsCmd } = await import("../../src/commands/facts")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await factsCmd.run!({
        args: { customer: "acme.com", timeframe: "30d", json: true },
      } as Parameters<NonNullable<typeof factsCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_get_facts",
        expect.objectContaining({ customer: "acme.com", timeframe: "30d" }),
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
    const { default: factsCmd } = await import("../../src/commands/facts")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await factsCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof factsCmd.run>>[0])
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
