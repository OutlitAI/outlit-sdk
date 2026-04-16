import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
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

describe("notify", () => {
  useTempEnv("notify-test")

  beforeEach(() => {
    mockCallTool.mockClear()
    mockReadFileSync.mockClear()
  })

  test("sends positional payload as raw string", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          payload: "plain text payload",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_send_notification",
        expect.objectContaining({
          title: "Risk found",
          payload: "plain text payload",
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("trims title and optional fields, parses JSON payload, and normalizes severity", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await notifyCmd.run!({
        args: {
          title: "  Risk found  ",
          payload: '{"customer":"acme.com"}',
          severity: "  HiGh  ",
          message: "  Check this account  ",
          source: "  ops-bot  ",
          subject: "  Escalation  ",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_send_notification",
        expect.objectContaining({
          title: "Risk found",
          payload: { customer: "acme.com" },
          severity: "high",
          message: "Check this account",
          source: "ops-bot",
          subject: "Escalation",
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("empty optional message, source, or subject returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          payload: "plain text payload",
          message: " ",
          source: " ",
          subject: " ",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
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

  test("title over 160 characters returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: `${"a".repeat(161)}`,
          payload: "plain text payload",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
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

  test("oversized payload returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          payload: JSON.stringify({ blob: "x".repeat(100001) }),
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
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

  test("--payload-file parses JSON and takes precedence over positional payload", async () => {
    mockReadFileSync.mockReturnValueOnce('{"customer":"acme.com"}')
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          payload: "ignored",
          "payload-file": "/tmp/payload.json",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_send_notification",
        expect.objectContaining({
          title: "Risk found",
          payload: { customer: "acme.com" },
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("invalid severity returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          payload: "plain text payload",
          severity: "urgent",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
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

  test("missing title returns missing_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          payload: "plain text payload",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "missing_input")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("missing payload returns missing_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "missing_input")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("file_error when --payload-file path is bad", async () => {
    mockReadFileSync.mockImplementationOnce((_path: string, _encoding: string): string => {
      throw new Error("ENOENT: no such file or directory")
    })

    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          "payload-file": "/nonexistent/payload.json",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "file_error")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })
})
