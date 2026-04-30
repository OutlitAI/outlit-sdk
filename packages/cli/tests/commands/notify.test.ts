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

describe("notify", () => {
  const testDir = useTempEnv("notify-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("help metadata concisely explains markdown notification behavior", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const description = (notifyCmd.meta as { description?: string } | undefined)?.description
    const args = notifyCmd.args as { markdown: { description: string } }

    expect(description).toContain(
      "Use --markdown or --markdown-file for the human-readable body; Outlit renders it for the destination platform.",
    )
    expect(args.markdown.description).toBe("Markdown body rendered for the destination platform.")
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

  test("sends markdown without a payload and forwards explicit destinations", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          markdown: "  **Risk found**\n\n- Customer: Acme  ",
          destination: "slack:C456",
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_send_notification",
        expect.objectContaining({
          title: "Risk found",
          markdown: "**Risk found**\n\n- Customer: Acme",
          destinations: [{ provider: "slack", channelId: "C456" }],
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("--markdown-file reads markdown and takes precedence over --markdown", async () => {
    const markdownPath = join(testDir, "notification.md")
    writeFileSync(markdownPath, "  **Risk found**\n\n- Customer: Acme  ")
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          markdown: "**ignored**",
          "markdown-file": markdownPath,
          json: true,
        },
      } as Parameters<NonNullable<typeof notifyCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_send_notification",
        expect.objectContaining({
          title: "Risk found",
          markdown: "**Risk found**\n\n- Customer: Acme",
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
    const payloadPath = join(testDir, "payload.json")
    writeFileSync(payloadPath, '{"customer":"acme.com"}')
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          payload: "ignored",
          "payload-file": payloadPath,
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

  test("missing payload and markdown returns missing_input", async () => {
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

  test("invalid destination returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          markdown: "**Risk found**",
          destination: "teams:C123",
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

  test("more than 10 destinations returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          markdown: "**Risk found**",
          destination: Array.from({ length: 11 }, (_, index) => `slack:C${index}`).join(","),
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

  test("destination channelId over 240 characters returns invalid_input", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          markdown: "**Risk found**",
          destination: `slack:${"C".repeat(241)}`,
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

  test("file_error when --payload-file path is bad", async () => {
    const { default: notifyCmd } = await import("../../src/commands/notify")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await notifyCmd.run!({
        args: {
          title: "Risk found",
          "payload-file": join(testDir, "missing-payload.json"),
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
