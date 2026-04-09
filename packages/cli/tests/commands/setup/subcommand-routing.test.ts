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
import { runCommand } from "citty"
import { setNonInteractive } from "../../helpers"

setNonInteractive()

function jsonWrites(calls: unknown[][]): Array<Record<string, unknown>> {
  const writes: Array<Record<string, unknown>> = []

  for (const call of calls) {
    const written = (call[0] as string) ?? ""

    try {
      writes.push(JSON.parse(written) as Record<string, unknown>)
    } catch {
      // Ignore non-JSON writes.
    }
  }

  return writes
}

describe("setup subcommand routing", () => {
  beforeEach(() => {
    mockExistsSync.mockClear()
    mockExecFileSync.mockClear()

    mockExistsSync.mockImplementation((path: string) =>
      ["/test-home/.factory", "/test-home/.config/opencode", "/test-home/.pi/agent"].includes(path),
    )

    mockExecFileSync.mockImplementation((cmd: string, args: string[], _opts?: unknown) => {
      if (cmd === "which" && ["claude", "codex", "gemini", "npx"].includes(args[0] ?? "")) {
        return undefined
      }
      if (cmd === "npx") return undefined
      throw new Error("not found")
    })
  })

  test("setup gemini via the parser does not fall through to auto-detect", async () => {
    const originalHome = process.env.HOME
    const originalXdg = process.env.XDG_CONFIG_HOME
    process.env.HOME = "/test-home"
    process.env.XDG_CONFIG_HOME = "/test-home/.config"

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await runCommand(setupCmd, { rawArgs: ["gemini", "--json"] })
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      const writes = jsonWrites(calls)
      expect(writes).toHaveLength(1)
      expect(writes[0]).toEqual({
        success: true,
        agent: "gemini",
        runner: "npx",
      })

      const npxCalls = mockExecFileSync.mock.calls.filter(([cmd]) => cmd === "npx")
      expect(npxCalls).toHaveLength(1)
      expect(npxCalls[0]?.[1]).toEqual([
        "-y",
        "skills",
        "add",
        "https://github.com/OutlitAI/outlit-agent-skills",
        "--skill",
        "outlit",
        "--agent",
        "gemini-cli",
        "-y",
        "-g",
      ])

      if (originalHome === undefined) Reflect.deleteProperty(process.env, "HOME")
      else process.env.HOME = originalHome
      if (originalXdg === undefined) Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
      else process.env.XDG_CONFIG_HOME = originalXdg
    }
  })

  test("setup skills via the parser stays on the interactive installer path", async () => {
    const originalHome = process.env.HOME
    const originalXdg = process.env.XDG_CONFIG_HOME
    process.env.HOME = "/test-home"
    process.env.XDG_CONFIG_HOME = "/test-home/.config"

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await runCommand(setupCmd, { rawArgs: ["skills", "--json"] })
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      const writes = jsonWrites(calls)
      expect(writes).toHaveLength(1)
      expect(writes[0]).toEqual({
        success: true,
        agent: "skills",
        runner: "npx",
      })

      const npxCalls = mockExecFileSync.mock.calls.filter(([cmd]) => cmd === "npx")
      expect(npxCalls).toHaveLength(1)
      expect(npxCalls[0]?.[1]).toEqual([
        "-y",
        "skills",
        "add",
        "https://github.com/OutlitAI/outlit-agent-skills",
        "-g",
      ])

      if (originalHome === undefined) Reflect.deleteProperty(process.env, "HOME")
      else process.env.HOME = originalHome
      if (originalXdg === undefined) Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
      else process.env.XDG_CONFIG_HOME = originalXdg
    }
  })
})
