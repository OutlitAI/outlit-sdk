// Register the mock before dynamically importing command modules.
import {
  installChildProcessMock,
  mockExecFileSync,
  resetChildProcessMocks,
} from "../../child-process-mock"

installChildProcessMock()

import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { ExitError, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("setup claude-code", () => {
  beforeEach(() => {
    resetChildProcessMocks()
  })

  test("installs the outlit skill for Claude Code", async () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: claudeCodeCmd } = await import("../../../src/commands/setup/claude-code")

    try {
      await claudeCodeCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof claudeCodeCmd.run>>[0])
    } finally {
      const calls = writeSpy.mock.calls.slice()
      writeSpy.mockRestore()

      expect(mockExecFileSync.mock.calls.length).toBe(2)

      const [runnerCmd, runnerArgs] = mockExecFileSync.mock.calls[1] as [string, string[]]
      expect(runnerCmd).toBe("npx")
      expect(runnerArgs).toEqual([
        "-y",
        "skills",
        "add",
        "https://github.com/OutlitAI/outlit-agent-skills",
        "--skill",
        "outlit",
        "--agent",
        "claude-code",
        "-y",
        "-g",
      ])

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.agent).toBe("claude-code")
      expect(result.runner).toBe("npx")
    }
  })

  test("runner_not_found when no package runner is available", async () => {
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" })
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: claudeCodeCmd } = await import("../../../src/commands/setup/claude-code")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await claudeCodeCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof claudeCodeCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    const parsed = JSON.parse(stderrWritten) as Record<string, string>
    expect(parsed.code).toBe("runner_not_found")
  })

  test("no auth required — command has no authArgs", async () => {
    const { default: claudeCodeCmd } = await import("../../../src/commands/setup/claude-code")
    expect(claudeCodeCmd.args).toBeDefined()
    const argKeys = Object.keys(claudeCodeCmd.args!)
    expect(argKeys).not.toContain("api-key")
  })
})
