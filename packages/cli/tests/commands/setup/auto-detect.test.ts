// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

const mockExistsSync = mock((_path: string) => false)

mock.module("node:fs", () => ({
  existsSync: mockExistsSync,
}))

const mockExecFileSync = mock((_cmd: string, _args: string[], _opts?: unknown) => undefined)

mock.module("node:child_process", () => ({
  execFileSync: mockExecFileSync,
}))

import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { setNonInteractive } from "../../helpers"

setNonInteractive()

function lastJsonWrite(calls: unknown[][]): Record<string, unknown> {
  for (let i = calls.length - 1; i >= 0; i--) {
    const written = (calls[i]?.[0] as string) ?? ""
    try {
      return JSON.parse(written) as Record<string, unknown>
    } catch {
      // Ignore non-JSON writes.
    }
  }
  throw new Error("No JSON write found in spy calls")
}

describe("setup auto-detect", () => {
  beforeEach(() => {
    mockExistsSync.mockClear()
    mockExecFileSync.mockClear()
    mockExistsSync.mockImplementation((_path: string) => false)
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw new Error("not found")
    })
  })

  test("detects command and config based agents and installs the outlit skill in one run", async () => {
    mockExecFileSync.mockImplementation((cmd: string, args: string[], _opts?: unknown) => {
      if (cmd === "which" && ["claude", "npx"].includes(args[0] ?? "")) return undefined
      if (cmd === "npx") return undefined
      throw new Error("not found")
    })
    mockExistsSync.mockImplementation((path: string) =>
      ["/test-home/.factory", "/test-home/.config/opencode", "/test-home/.pi/agent"].includes(path),
    )

    const originalHome = process.env.HOME
    const originalXdg = process.env.XDG_CONFIG_HOME
    process.env.HOME = "/test-home"
    process.env.XDG_CONFIG_HOME = "/test-home/.config"

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      const result = lastJsonWrite(calls) as {
        detected: string[]
        configured: string[]
        failed: string[]
        runner: string | null
      }

      expect(result.detected).toEqual(["claude-code", "droid", "opencode", "pi"])
      expect(result.configured).toEqual(["claude-code", "droid", "opencode", "pi"])
      expect(result.failed).toHaveLength(0)
      expect(result.runner).toBe("npx")

      const [runnerCmd, runnerArgs] = mockExecFileSync.mock.calls.at(-1) as [string, string[]]
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
        "--agent",
        "droid",
        "--agent",
        "opencode",
        "--agent",
        "pi",
        "-y",
        "-g",
      ])
      if (originalHome === undefined) Reflect.deleteProperty(process.env, "HOME")
      else process.env.HOME = originalHome
      if (originalXdg === undefined) Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
      else process.env.XDG_CONFIG_HOME = originalXdg
    }
  })

  test("outputs empty result when no agents are detected", async () => {
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as {
        detected: string[]
        configured: string[]
        failed: string[]
        runner: string | null
      }

      expect(result.detected).toHaveLength(0)
      expect(result.configured).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.runner).toBeNull()
    }
  })

  test("records all detected agents as failed when targeted skills install fails", async () => {
    mockExecFileSync.mockImplementation((cmd: string, args: string[], _opts?: unknown) => {
      if (cmd === "which" && ["claude", "npx"].includes(args[0] ?? "")) return undefined
      if (cmd === "npx") throw new Error("skills add failed")
      throw new Error("not found")
    })
    mockExistsSync.mockImplementation((path: string) => path === "/test-home/.factory")

    const originalHome = process.env.HOME
    process.env.HOME = "/test-home"

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      const result = lastJsonWrite(calls) as {
        detected: string[]
        configured: string[]
        failed: string[]
        runner: string | null
      }

      expect(result.detected).toEqual(["claude-code", "droid"])
      expect(result.configured).toHaveLength(0)
      expect(result.failed).toEqual(["claude-code", "droid"])
      expect(result.runner).toBe("npx")
      if (originalHome === undefined) Reflect.deleteProperty(process.env, "HOME")
      else process.env.HOME = originalHome
    }
  })

  test("no auth required — command has no authArgs", async () => {
    const { default: setupCmd } = await import("../../../src/commands/setup/index")
    expect(setupCmd.args).toBeDefined()
    const argKeys = Object.keys(setupCmd.args!)
    expect(argKeys).not.toContain("api-key")
  })
})
