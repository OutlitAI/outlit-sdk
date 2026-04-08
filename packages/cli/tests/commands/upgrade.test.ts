import { describe, expect, mock, spyOn, test } from "bun:test"
import { CLI_VERSION } from "../../src/lib/config"
import { ExitError, mockExitThrow } from "../helpers"

const mockSpawnSync = mock(() => ({ status: 0 }))
const mockSpawn = mock(() => ({ unref: mock(() => {}) }))

mock.module("node:child_process", () => ({
  spawn: mockSpawn,
  spawnSync: mockSpawnSync,
}))

describe("upgrade command", () => {
  test("does not run the installer when the CLI is already current", async () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: CLI_VERSION }), { status: 200 }),
    )
    const consoleSpy = spyOn(console, "log").mockImplementation(() => {})

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")
    let logged = ""

    try {
      await upgradeCmd.run!({ args: {} } as Parameters<NonNullable<typeof upgradeCmd.run>>[0])
      logged = (consoleSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      fetchSpy.mockRestore()
      consoleSpy.mockRestore()
      Reflect.deleteProperty(process.env, "npm_config_user_agent")
    }

    expect(mockSpawnSync).not.toHaveBeenCalled()
    expect(logged).toBe(`Outlit CLI is already up to date (v${CLI_VERSION})`)
  })

  test("fails when the installer cannot be inferred", async () => {
    const { default: upgradeCmd } = await import("../../src/commands/upgrade")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await upgradeCmd.run!({ args: {} } as Parameters<NonNullable<typeof upgradeCmd.run>>[0])
    } catch (error) {
      thrown = error
      stderrOutput = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrOutput).toContain("Could not determine how Outlit CLI was installed")
  })

  test("runs the inferred package manager command when a newer version exists", async () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    )

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")

    try {
      await upgradeCmd.run!({ args: {} } as Parameters<NonNullable<typeof upgradeCmd.run>>[0])
    } finally {
      fetchSpy.mockRestore()
      Reflect.deleteProperty(process.env, "npm_config_user_agent")
    }

    expect(mockSpawnSync).toHaveBeenCalledWith("bun", ["add", "-g", "@outlit/cli"], {
      stdio: "inherit",
    })
  })

  test("fails cleanly when the latest version check fails", async () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))
    const { default: upgradeCmd } = await import("../../src/commands/upgrade")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await upgradeCmd.run!({ args: {} } as Parameters<NonNullable<typeof upgradeCmd.run>>[0])
    } catch (error) {
      thrown = error
      stderrOutput = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
    } finally {
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
      Reflect.deleteProperty(process.env, "npm_config_user_agent")
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrOutput).toContain("Could not check for CLI updates")
  })
})
