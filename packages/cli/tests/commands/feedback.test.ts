import { beforeEach, describe, expect, mock, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockResult = {
  id: "10000000-0000-4000-8000-000000000004",
  createdAt: "2026-09-28T12:00:00.000Z",
}
const mockCallTool = mock(async () => mockResult)

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("feedback", () => {
  const testDir = useTempEnv("feedback-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("submits a plain body", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    const parsed = await captureStdout<typeof mockResult>(() =>
      command.run!({
        args: { json: true, body: "The merge preview dropped trait history" },
      } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_submit_feedback", {
      body: "The merge preview dropped trait history",
    })
    expect(parsed).toMatchObject({ id: mockResult.id, createdAt: mockResult.createdAt })
  })

  test("trims surrounding whitespace from the body before submitting", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await captureStdout(() =>
      command.run!({ args: { json: true, body: "  padded body\n\n" } } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_submit_feedback", {
      body: "padded body",
    })
  })

  test("accepts a trimmed body of exactly 20000 characters", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await captureStdout(() =>
      command.run!({ args: { json: true, body: ` ${"x".repeat(20_000)} ` } } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_submit_feedback", {
      body: "x".repeat(20_000),
    })
  })

  test("measures context size on the serialized object, not raw input whitespace", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    // Raw input exceeds 16 KiB purely through insignificant whitespace; the
    // serialized contract object stays under the limit and must be accepted.
    const context = `{ ${" ".repeat(17 * 1024)} "surface": "cli" }`
    await captureStdout(() => command.run!({ args: { json: true, body: "ok", context } } as never))

    expect(mockCallTool).toHaveBeenCalledWith("outlit_submit_feedback", {
      body: "ok",
      context: { surface: "cli" },
    })
  })

  test("submits body with trimmed area and parsed context", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await captureStdout(() =>
      command.run!({
        args: {
          json: true,
          body: "Add an export for attention items",
          area: "  attention  ",
          context: '{"surface":"cli","command":"attention list"}',
        },
      } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_submit_feedback", {
      body: "Add an export for attention items",
      area: "attention",
      context: { surface: "cli", command: "attention list" },
    })
  })

  test("reads body and context from files", async () => {
    const bodyPath = join(testDir, "feedback.md")
    const contextPath = join(testDir, "diagnostics.json")
    writeFileSync(bodyPath, "Feedback body from a file\nwith two lines\n")
    writeFileSync(contextPath, '{"surface":"cli","cliVersion":"3.2.2"}')

    const { default: command } = await import("../../src/commands/feedback")
    await captureStdout(() =>
      command.run!({
        args: { json: true, "body-file": bodyPath, "context-file": contextPath },
      } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_submit_feedback", {
      body: "Feedback body from a file\nwith two lines",
      context: { surface: "cli", cliVersion: "3.2.2" },
    })
  })

  test("rejects missing body", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(() => command.run!({ args: { json: true } } as never), "missing_input")
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects whitespace-only body", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "   " } } as never),
      "missing_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects --body together with --body-file", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () =>
        command.run!({
          args: { json: true, body: "text", "body-file": join(testDir, "feedback.md") },
        } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects a body over 20000 characters", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "x".repeat(20_001) } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects an area over 100 characters", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "ok", area: "a".repeat(101) } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects whitespace-only area", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "ok", area: "  " } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects context that is not a JSON object", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () =>
        command.run!({ args: { json: true, body: "ok", context: '["not","object"]' } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects malformed context JSON", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "ok", context: "{oops" } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects context over 16 KiB serialized", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    const context = JSON.stringify({ data: "x".repeat(16 * 1024) })
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "ok", context } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("measures the context limit in UTF-8 bytes, not characters", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    // "★" is 3 UTF-8 bytes: ~5.5k chars stay under 16 KiB by character count
    // but exceed the byte limit once serialized.
    const context = JSON.stringify({ data: "★".repeat(6 * 1024) })
    await runExpectingError(
      () => command.run!({ args: { json: true, body: "ok", context } } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects --context together with --context-file", async () => {
    const { default: command } = await import("../../src/commands/feedback")
    await runExpectingError(
      () =>
        command.run!({
          args: {
            json: true,
            body: "ok",
            context: "{}",
            "context-file": join(testDir, "diagnostics.json"),
          },
        } as never),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
