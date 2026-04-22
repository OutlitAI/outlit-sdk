import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  rows: [],
  rowCount: 0,
}))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("sql", () => {
  const testDir = useTempEnv("sql-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends positional query as sql param", async () => {
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await sqlCmd.run!({
        args: { query: "SELECT 1", limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_query",
        expect.objectContaining({ sql: "SELECT 1" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--query-file reads file and sends contents as sql", async () => {
    const queryPath = join(testDir, "query.sql")
    writeFileSync(queryPath, "SELECT * FROM activity")
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await sqlCmd.run!({
        args: { "query-file": queryPath, limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_query",
        expect.objectContaining({ sql: "SELECT * FROM activity" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--query-file takes precedence over positional", async () => {
    const queryPath = join(testDir, "query.sql")
    writeFileSync(queryPath, "SELECT * FROM revenue")
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await sqlCmd.run!({
        args: { query: "SELECT 1", "query-file": queryPath, limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_query",
        expect.objectContaining({ sql: "SELECT * FROM revenue" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("missing_input error when no query or file", async () => {
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await sqlCmd.run!({
        args: { limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "missing_input")
    }
  })

  test("file_error when --query-file path is bad", async () => {
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await sqlCmd.run!({
        args: { "query-file": join(testDir, "missing.sql"), limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "file_error")
    }
  })

  test.each([
    ["1.5", "--limit must be an integer between 1 and 10000"],
    ["10001", "--limit must be an integer between 1 and 10000"],
  ])("invalid_input error when --limit is %s", async (limit, expectedMessage) => {
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await sqlCmd.run!({
        args: { query: "SELECT 1", limit, json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(stderrOutput).toContain(expectedMessage)
    }
  })
})
