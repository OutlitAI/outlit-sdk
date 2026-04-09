// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

const mockExecFileSync = mock((_cmd: string, _args: string[], _opts?: unknown) => undefined)

mock.module("node:child_process", () => ({
  execFileSync: mockExecFileSync,
}))

import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { ExitError, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("setup codex", () => {
  beforeEach(() => {
    mockExecFileSync.mockClear()
    mockExecFileSync.mockImplementation(
      (_cmd: string, _args: string[], _opts?: unknown) => undefined,
    )
  })

  test("installs the outlit skill for Codex", async () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: codexCmd } = await import("../../../src/commands/setup/codex")

    try {
      await codexCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof codexCmd.run>>[0])
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
        "codex",
        "-y",
        "-g",
      ])

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.agent).toBe("codex")
      expect(result.runner).toBe("npx")
    }
  })

  test("runner_not_found when no package runner is available", async () => {
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" })
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: codexCmd } = await import("../../../src/commands/setup/codex")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await codexCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof codexCmd.run>>[0])
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
})
