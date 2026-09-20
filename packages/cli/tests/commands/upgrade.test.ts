import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { CLI_VERSION } from "../../src/lib/config"
import {
  installChildProcessMock,
  mockSpawnSync,
  resetChildProcessMocks,
} from "../child-process-mock"
import {
  captureStdout,
  ExitError,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
} from "../helpers"

installChildProcessMock()

const ORIGINAL_ARGV1 = process.argv[1]

function restoreArgv1() {
  if (ORIGINAL_ARGV1 === undefined) {
    Reflect.deleteProperty(process.argv, "1")
  } else {
    process.argv[1] = ORIGINAL_ARGV1
  }
}

describe("upgrade command", () => {
  beforeEach(() => {
    resetChildProcessMocks()
  })

  afterEach(() => {
    restoreArgv1()
    Reflect.deleteProperty(process.env, "npm_config_user_agent")
    Reflect.deleteProperty(process.env, "npm_config_prefix")
  })

  test("reports current version as structured output when already up to date", async () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: CLI_VERSION }), { status: 200 }),
    )

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")
    let result: Record<string, unknown> = {}
    try {
      result = await captureStdout(() =>
        upgradeCmd.run!({ args: { json: true } } as Parameters<
          NonNullable<typeof upgradeCmd.run>
        >[0]),
      )
    } finally {
      fetchSpy.mockRestore()
    }

    expect(mockSpawnSync).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: "current",
      currentVersion: CLI_VERSION,
      latestVersion: CLI_VERSION,
    })
  })

  test("checks the registry before installer detection so standalone installs get an already-current answer", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: CLI_VERSION }), { status: 200 }),
    )
    process.argv[1] = "upgrade" // compiled binary argv shape: no script path

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")
    let result: Record<string, unknown> = {}
    try {
      result = await captureStdout(() =>
        upgradeCmd.run!({ args: { json: true } } as Parameters<
          NonNullable<typeof upgradeCmd.run>
        >[0]),
      )
    } finally {
      fetchSpy.mockRestore()
    }

    expect(result.status).toBe("current")
    expect(mockSpawnSync).not.toHaveBeenCalled()
  })

  test("fails with package-manager guidance when the installer cannot be inferred", async () => {
    process.argv[1] = "/usr/local/lib/node_modules/@outlit/cli/dist/cli.js"
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    )
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
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrOutput).toContain("unknown_installer")
    expect(stderrOutput).toContain("package manager")
  })

  test("gives standalone binaries manual-update guidance instead of a package-manager command", async () => {
    process.argv[1] = "upgrade" // compiled binary argv shape
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    )
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
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrOutput).toContain("unknown_installer")
    expect(stderrOutput).toContain("9.9.9")
    expect(stderrOutput).toContain("install.sh")
    expect(stderrOutput).not.toContain("npm install -g")
  })

  test("fails cleanly when the latest version check fails and no installer is detected", async () => {
    process.argv[1] = "upgrade"
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
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrOutput).toContain("update_check_failed")
  })

  test("runs the inferred package manager command when a newer version exists", async () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    )

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")
    let result: Record<string, unknown> = {}
    try {
      result = await captureStdout(() =>
        upgradeCmd.run!({ args: { json: true } } as Parameters<
          NonNullable<typeof upgradeCmd.run>
        >[0]),
      )
    } finally {
      fetchSpy.mockRestore()
    }

    expect(mockSpawnSync).toHaveBeenCalledWith("bun", ["add", "-g", "@outlit/cli"], {
      stdio: ["ignore", process.stderr, process.stderr],
    })
    expect(result).toEqual({
      status: "updated",
      currentVersion: CLI_VERSION,
      latestVersion: "9.9.9",
      command: "bun add -g @outlit/cli",
    })
  })

  test("keeps package-manager output on stdout in interactive mode", async () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    setInteractive()
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    )

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")

    try {
      await upgradeCmd.run!({ args: {} } as Parameters<NonNullable<typeof upgradeCmd.run>>[0])
    } finally {
      fetchSpy.mockRestore()
      setNonInteractive()
    }

    expect(mockSpawnSync).toHaveBeenCalledWith("bun", ["add", "-g", "@outlit/cli"], {
      stdio: "inherit",
    })
  })

  test("uses npm when the installed cli path is under the npm prefix", async () => {
    process.env.npm_config_prefix = "/tmp/outlit-prefix"
    const originalArgv1 = process.argv[1]
    process.argv[1] = "/tmp/outlit-prefix/node_modules/@outlit/cli/dist/cli.js"

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    )

    const { default: upgradeCmd } = await import("../../src/commands/upgrade")

    try {
      await upgradeCmd.run!({ args: {} } as Parameters<NonNullable<typeof upgradeCmd.run>>[0])
    } finally {
      fetchSpy.mockRestore()
      if (originalArgv1 === undefined) {
        Reflect.deleteProperty(process.argv, "1")
      } else {
        process.argv[1] = originalArgv1
      }
      Reflect.deleteProperty(process.env, "npm_config_prefix")
    }

    // args:{} but non-TTY auto-enables JSON mode -> child output routed to stderr
    expect(mockSpawnSync).toHaveBeenCalledWith("npm", ["install", "-g", "@outlit/cli"], {
      stdio: ["ignore", process.stderr, process.stderr],
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
