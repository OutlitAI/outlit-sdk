import { beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  CLI_VERSION,
  clearCachedUpdateState,
  compareVersions,
  formatUpdateCommand,
  getCachedUpdateNotice,
  getUpdateCachePath,
  getUpgradeCommand,
  inferInstallerFromInstallation,
  isUpdateCheckDue,
  shouldCheckForUpdates,
  writeCachedUpdateState,
} from "../../src/lib/update"
import { setInteractive, setNonInteractive, useTempEnv } from "../helpers"

describe("update helpers", () => {
  useTempEnv("update-lib")

  beforeEach(() => {
    clearCachedUpdateState()
    Reflect.deleteProperty(process.env, "OUTLIT_NO_UPDATE_NOTIFIER")
    Reflect.deleteProperty(process.env, "npm_config_user_agent")
    setNonInteractive()
  })

  test("considers a check due when the last check is older than 12 hours", () => {
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000
    expect(isUpdateCheckDue({ lastCheckedAt: thirteenHoursAgo })).toBe(true)
  })

  test("considers a check fresh when the last check is within 12 hours", () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    expect(isUpdateCheckDue({ lastCheckedAt: oneHourAgo })).toBe(false)
  })

  test("ignores a corrupted cache file when reading cached update state", () => {
    const cachePath = getUpdateCachePath()
    mkdirSync(join(cachePath, ".."), { recursive: true })
    writeFileSync(cachePath, "not json")

    expect(getCachedUpdateNotice()).toBeNull()
  })

  test("returns a cached update notice when a newer version is stored", () => {
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      latestVersion: "9.9.9",
      installer: "bun",
    })

    expect(getCachedUpdateNotice()).toEqual({
      currentVersion: CLI_VERSION,
      latestVersion: "9.9.9",
      command: "bun add -g @outlit/cli",
    })
  })

  test("does not return a cached update notice when current version is latest", () => {
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      latestVersion: CLI_VERSION,
      installer: "bun",
    })

    expect(getCachedUpdateNotice()).toBeNull()
  })

  test("compares semver-like versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1)
    expect(compareVersions("1.4.1", "1.4.1")).toBe(0)
    expect(compareVersions("1.4.1", "1.5.0")).toBe(-1)
  })

  test("formats update command from bun user agent", () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    expect(formatUpdateCommand()).toBe("bun add -g @outlit/cli")
  })

  test("formats update command from npm user agent", () => {
    process.env.npm_config_user_agent = "npm/10.9.0 node/v22.0.0 darwin x64"
    expect(formatUpdateCommand()).toBe("npm install -g @outlit/cli")
  })

  test("returns a generic update hint when installer cannot be inferred", () => {
    expect(formatUpdateCommand()).toBe("update @outlit/cli with your package manager")
  })

  test("returns an executable upgrade command for bun", () => {
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"
    expect(getUpgradeCommand()).toEqual({
      command: "bun",
      args: ["add", "-g", "@outlit/cli"],
      displayCommand: "bun add -g @outlit/cli",
    })
  })

  test("returns null when no executable upgrade command can be inferred", () => {
    expect(getUpgradeCommand()).toBeNull()
  })

  test("infers npm from an installed cli path under the npm prefix", () => {
    expect(
      inferInstallerFromInstallation({
        argv1: "/tmp/outlit-prefix/node_modules/@outlit/cli/dist/cli.js",
        realExecPath: "/tmp/outlit-prefix/node_modules/@outlit/cli/dist/cli.js",
        npmGlobalPrefix: "/tmp/outlit-prefix",
      }),
    ).toBe("npm")
  })

  test("infers npm from a global npm install path under lib/node_modules", () => {
    expect(
      inferInstallerFromInstallation({
        argv1: "/usr/local/bin/outlit",
        realExecPath: "/usr/local/lib/node_modules/@outlit/cli/dist/cli.js",
        npmGlobalPrefix: "/usr/local",
      }),
    ).toBe("npm")
  })

  test("allows update checks in interactive terminals", () => {
    setInteractive()
    expect(shouldCheckForUpdates()).toBe(true)
  })

  test("skips update checks outside interactive terminals", () => {
    setNonInteractive()
    expect(shouldCheckForUpdates()).toBe(false)
  })

  test("skips update checks when explicitly disabled", () => {
    setInteractive()
    process.env.OUTLIT_NO_UPDATE_NOTIFIER = "1"
    expect(shouldCheckForUpdates()).toBe(false)
  })

  test("persists cached update state to disk", () => {
    writeCachedUpdateState({
      lastCheckedAt: 123,
      latestVersion: "2.0.0",
      installer: "npm",
    })

    const written = JSON.parse(readFileSync(getUpdateCachePath(), "utf8")) as Record<
      string,
      unknown
    >
    expect(written.latestVersion).toBe("2.0.0")
    expect(written.installer).toBe("npm")
  })
})
