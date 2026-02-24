import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
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

  test("sends table param when provided", async () => {
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await schemaCmd.run!({
        args: { table: "events", json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_schema",
        expect.objectContaining({ table: "events" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("omits table param when not provided", async () => {
    const { default: schemaCmd } = await import("../../src/commands/schema")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await schemaCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof schemaCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).not.toHaveProperty("table")
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
