// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

const mockExecFileSync = mock((_cmd: string, _args: string[], _opts?: unknown) => undefined)

mock.module("node:child_process", () => ({
  execFileSync: mockExecFileSync,
}))

import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { ExitError, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("setup skills", () => {
  beforeEach(() => {
    mockExecFileSync.mockClear()
    mockExecFileSync.mockImplementation(
      (_cmd: string, _args: string[], _opts?: unknown) => undefined,
    )
  })

  test("detects npx and runs interactive skills add for the Outlit repo", async () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: skillsCmd } = await import("../../../src/commands/setup/skills")

    try {
      await skillsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof skillsCmd.run>>[0])
    } finally {
      const calls = writeSpy.mock.calls.slice()
      writeSpy.mockRestore()

      expect(mockExecFileSync.mock.calls.length).toBe(2)

      const [detectionCmd, detectionArgs] = mockExecFileSync.mock.calls[0] as [string, string[]]
      expect(detectionCmd).toBe("which")
      expect(detectionArgs).toEqual(["npx"])

      const [runnerCmd, runnerArgs] = mockExecFileSync.mock.calls[1] as [string, string[]]
      expect(runnerCmd).toBe("npx")
      expect(runnerArgs).toEqual([
        "-y",
        "skills",
        "add",
        "https://github.com/OutlitAI/outlit-agent-skills",
        "-g",
      ])

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.agent).toBe("skills")
      expect(result.runner).toBe("npx")
    }
  })

  test("falls back to bunx when npx is not available", async () => {
    mockExecFileSync.mockImplementation((cmd: string, args: string[], _opts?: unknown) => {
      if (cmd === "which" && args[0] === "npx") {
        throw Object.assign(new Error("not found"), { code: "ENOENT" })
      }
      return undefined
    })

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: skillsCmd } = await import("../../../src/commands/setup/skills")

    try {
      await skillsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof skillsCmd.run>>[0])
    } finally {
      const calls = writeSpy.mock.calls.slice()
      writeSpy.mockRestore()

      expect(mockExecFileSync.mock.calls.length).toBe(3)

      const [runnerCmd, runnerArgs] = mockExecFileSync.mock.calls[2] as [string, string[]]
      expect(runnerCmd).toBe("bunx")
      expect(runnerArgs).toEqual([
        "skills",
        "add",
        "https://github.com/OutlitAI/outlit-agent-skills",
        "-g",
      ])

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.runner).toBe("bunx")
    }
  })

  test("runner_not_found when no package runner available", async () => {
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" })
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: skillsCmd } = await import("../../../src/commands/setup/skills")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await skillsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof skillsCmd.run>>[0])
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

  test("skills_install_error when skills add fails", async () => {
    let callCount = 0
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown) => {
      callCount++
      if (callCount === 1) return undefined
      throw new Error("skills add failed: network error")
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: skillsCmd } = await import("../../../src/commands/setup/skills")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await skillsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof skillsCmd.run>>[0])
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
    expect(parsed.code).toBe("skills_install_error")
    expect(parsed.error).toContain("network error")
  })

  test("no auth required — command has no authArgs", async () => {
    const { default: skillsCmd } = await import("../../../src/commands/setup/skills")
    expect(skillsCmd.args).toBeDefined()
    const argKeys = Object.keys(skillsCmd.args!)
    expect(argKeys).not.toContain("api-key")
  })
})
