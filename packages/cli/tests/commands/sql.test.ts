import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  useTempEnv,
} from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  rows: [],
  rowCount: 0,
}))

// readFileSync mock: default throws so we can override per-test
const mockReadFileSync = mock((_path: string, _encoding: string): string => {
  throw new Error("readFileSync not mocked for this test")
})

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

mock.module("node:fs", () => ({
  readFileSync: mockReadFileSync,
}))

setNonInteractive()

describe("sql", () => {
  useTempEnv("sql-test")

  beforeEach(() => {
    mockCallTool.mockClear()
    mockReadFileSync.mockClear()
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
    mockReadFileSync.mockReturnValueOnce("SELECT * FROM events")
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await sqlCmd.run!({
        args: { "query-file": "/tmp/query.sql", limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_query",
        expect.objectContaining({ sql: "SELECT * FROM events" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--query-file takes precedence over positional", async () => {
    mockReadFileSync.mockReturnValueOnce("SELECT * FROM mrr_snapshots")
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await sqlCmd.run!({
        args: { query: "SELECT 1", "query-file": "/tmp/query.sql", limit: "1000", json: true },
      } as Parameters<NonNullable<typeof sqlCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_query",
        expect.objectContaining({ sql: "SELECT * FROM mrr_snapshots" }),
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
    mockReadFileSync.mockImplementationOnce((_path: string, _encoding: string): string => {
      throw new Error("ENOENT: no such file or directory")
    })
    const { default: sqlCmd } = await import("../../src/commands/sql")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await sqlCmd.run!({
        args: { "query-file": "/nonexistent/path.sql", limit: "1000", json: true },
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
})
