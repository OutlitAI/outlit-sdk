import { beforeEach, describe, expect, mock, test } from "bun:test"
import { CLI_VERSION } from "../../src/lib/config"
import {
  clearCachedUpdateState,
  initializeUpdateNotifier,
  runInternalUpdateCheck,
  writeCachedUpdateState,
} from "../../src/lib/update"
import { setInteractive, setNonInteractive, useTempEnv } from "../helpers"

describe("update notifier", () => {
  useTempEnv("update-notifier")

  beforeEach(() => {
    clearCachedUpdateState()
    Reflect.deleteProperty(process.env, "OUTLIT_NO_UPDATE_NOTIFIER")
    Reflect.deleteProperty(process.env, "npm_config_user_agent")
    setNonInteractive()
  })

  test("prints a cached update notice during interactive runs", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      latestVersion: "9.9.9",
      installer: "bun",
    })

    const notify = mock((_message: string) => {})
    const spawn = mock(() => ({ unref: mock(() => {}) }))

    initializeUpdateNotifier({ argv: ["bun", "src/cli.ts", "customers", "list"], spawn, notify })

    const written = (notify.mock.calls[0]?.[0] as string) ?? ""
    expect(written).toBe(
      `Outlit CLI update available: ${CLI_VERSION} -> 9.9.9\nUpdate with: bun add -g @outlit/cli`,
    )
    expect(spawn).not.toHaveBeenCalled()
  })

  test("does not print a cached update notice for non-interactive runs", () => {
    setNonInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      latestVersion: "9.9.9",
      installer: "bun",
    })

    const notify = mock((_message: string) => {})
    const spawn = mock(() => ({ unref: mock(() => {}) }))

    initializeUpdateNotifier({ argv: ["bun", "src/cli.ts", "customers", "list"], spawn, notify })

    expect(notify).not.toHaveBeenCalled()
  })

  test("does not print a cached update notice for --json runs", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      latestVersion: "9.9.9",
      installer: "bun",
    })

    const notify = mock((_message: string) => {})
    const spawn = mock(() => ({ unref: mock(() => {}) }))

    initializeUpdateNotifier({ argv: ["bun", "src/cli.ts", "doctor", "--json"], spawn, notify })

    expect(notify).not.toHaveBeenCalled()
  })

  test("schedules a background refresh when the cache is stale", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now() - 13 * 60 * 60 * 1000,
      latestVersion: "9.9.9",
      installer: "bun",
    })

    const spawn = mock(() => ({ unref: mock(() => {}) }))
    const notify = mock((_message: string) => {})

    initializeUpdateNotifier({ argv: ["bun", "src/cli.ts", "customers", "list"], spawn, notify })

    expect(spawn).toHaveBeenCalledWith("bun", ["src/cli.ts", "--internal-update-check"], {
      detached: true,
      stdio: "ignore",
    })
  })

  test("respawns the standalone executable itself for background checks", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now() - 13 * 60 * 60 * 1000,
      latestVersion: "9.9.9",
      installer: "bun",
    })

    const spawn = mock(() => ({ unref: mock(() => {}) }))
    const notify = mock((_message: string) => {})

    // Compiled-binary argv shape: real binary path + virtual $bunfs entrypoint.
    initializeUpdateNotifier({
      argv: ["/home/u/.local/bin/outlit", "/$bunfs/root/outlit", "customers"],
      spawn,
      notify,
      execPath: "/home/u/.local/bin/outlit",
    })

    expect(spawn).toHaveBeenCalledWith("/home/u/.local/bin/outlit", ["--internal-update-check"], {
      detached: true,
      stdio: "ignore",
    })
  })

  test("keeps the runtime-plus-script spawn for node script installs", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now() - 13 * 60 * 60 * 1000,
      latestVersion: "9.9.9",
      installer: "npm",
    })

    const spawn = mock(() => ({ unref: mock(() => {}) }))
    const notify = mock((_message: string) => {})

    initializeUpdateNotifier({
      argv: ["/usr/bin/node", "/opt/outlit/dist/cli.js", "doctor"],
      spawn,
      notify,
      execPath: "/usr/bin/node",
    })

    expect(spawn).toHaveBeenCalledWith(
      "/usr/bin/node",
      ["/opt/outlit/dist/cli.js", "--internal-update-check"],
      { detached: true, stdio: "ignore" },
    )
  })

  test("attaches an error listener so asynchronous spawn failures stay silent", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now() - 13 * 60 * 60 * 1000,
      latestVersion: "9.9.9",
    })

    const child = {
      unref: mock(() => {}),
      on: mock((_event: string, _cb: (error: Error) => void) => {}),
    }
    const spawn = mock(() => child)

    initializeUpdateNotifier({ argv: ["bun", "src/cli.ts", "doctor"], spawn })

    expect(child.on).toHaveBeenCalledWith("error", expect.any(Function))
    expect(child.unref).toHaveBeenCalled()
  })

  test("does not crash the foreground command when spawn throws synchronously", () => {
    setInteractive()
    writeCachedUpdateState({
      lastCheckedAt: Date.now() - 13 * 60 * 60 * 1000,
      latestVersion: "9.9.9",
    })

    const spawn = mock(() => {
      throw new Error("spawn bun ENOENT")
    })

    expect(() =>
      initializeUpdateNotifier({ argv: ["bun", "src/cli.ts", "doctor"], spawn }),
    ).not.toThrow()
  })

  test("internal update checks refresh the cache without printing", async () => {
    await runInternalUpdateCheck({
      fetchLatestVersion: async () => "9.9.9",
      installer: "npm",
    })
  })
})
