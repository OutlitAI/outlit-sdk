import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  tables: [],
}))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("schema", () => {
  useTempEnv("schema-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends topic view and the view name for a requested view", async () => {
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await schemaCmd.run!({
        args: { view: "activity", json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_schema", {
        topic: "view",
        view: "activity",
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test.each([
    ["events", { topic: "event_types" }],
    ["examples", { topic: "examples" }],
    ["arr_history", { topic: "view", view: "arr_history" }],
  ])("maps %s to its schema topic", async (view, expected) => {
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await schemaCmd.run!({
        args: { view, json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_schema", expected)
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("rejects a name that is neither a view nor a topic before calling Core", async () => {
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await schemaCmd.run!({
        args: { view: "orders", json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("sends no params when no view is given, so Core describes every view", async () => {
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await schemaCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).toEqual({})
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("auth_required error — createClient throws → outputError called", async () => {
    const clientModule = await import("../../src/lib/client")
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY."),
    )
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await schemaCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])
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
