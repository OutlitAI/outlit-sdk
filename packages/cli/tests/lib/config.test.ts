import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  getConfigDir,
  maskKey,
  readJsonConfig,
  requireCredential,
  resolveApiKey,
  storeApiKey,
} from "../../src/lib/config"
import { TEST_API_KEY, expectErrorExit, mockExitThrow, useTempEnv } from "../helpers"

describe("getConfigDir()", () => {
  test('returns platform-appropriate config path containing "outlit"', () => {
    const dir = getConfigDir()
    expect(typeof dir).toBe("string")
    expect(dir.length).toBeGreaterThan(0)
    expect(dir).toMatch(/outlit/)
  })

  test("uses XDG_CONFIG_HOME when set on non-Windows", () => {
    if (process.platform === "win32") return
    const original = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = "/custom/config"
    try {
      expect(getConfigDir()).toBe("/custom/config/outlit")
    } finally {
      if (original !== undefined) process.env.XDG_CONFIG_HOME = original
      else Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
    }
  })
})

describe("maskKey()", () => {
  test("returns key as-is when 9 chars or fewer", () => {
    expect(maskKey("ok_short")).toBe("ok_short") // 8 chars
    expect(maskKey("123456789")).toBe("123456789") // exactly 9 chars
  })

  test("masks key with first 5, ellipsis, last 4", () => {
    expect(maskKey("ok_testabc1234")).toBe("ok_te...1234")
    expect(maskKey(TEST_API_KEY)).toBe("ok_aa...aaaa")
  })
})

describe("readJsonConfig()", () => {
  // readJsonConfig takes an explicit path — no env vars needed.
  // Use a manual temp dir to avoid process.env mutations that cause
  // race conditions with Bun's parallel test file execution.
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `outlit-cli-readjson-${process.pid}-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  test("returns {} for a missing file", () => {
    expect(readJsonConfig(join(testDir, "nonexistent.json"))).toEqual({})
  })

  test("returns parsed object for a valid JSON file", () => {
    const path = join(testDir, "valid.json")
    writeFileSync(path, JSON.stringify({ mcpServers: { outlit: {} } }))
    expect(readJsonConfig(path)).toEqual({ mcpServers: { outlit: {} } })
  })

  test("returns {} for a malformed JSON file", () => {
    const path = join(testDir, "bad.json")
    writeFileSync(path, "NOT JSON AT ALL")
    expect(readJsonConfig(path)).toEqual({})
  })
})

describe("requireCredential()", () => {
  useTempEnv("config-require-cred")

  test("returns the credential when a key is present", () => {
    const exitSpy = mockExitThrow()
    let result: ReturnType<typeof requireCredential> | undefined
    try {
      result = requireCredential(undefined, false)
    } finally {
      exitSpy.mockRestore()
    }
    expect(result?.key).toBe(TEST_API_KEY)
    expect(result?.source).toBe("env")
  })

  test("exits with not_authenticated when no credential found", () => {
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let thrown: unknown
    let written = ""
    try {
      requireCredential(undefined, true)
    } catch (e) {
      thrown = e
    } finally {
      written = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }
    expectErrorExit(thrown, written, "not_authenticated")
  })
})

describe("storeApiKey() and resolveApiKey()", () => {
  useTempEnv("config-store-resolve")

  beforeEach(() => {
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
  })

  test("storeApiKey writes credentials.json and returns the path", () => {
    const path = storeApiKey(TEST_API_KEY)
    expect(existsSync(path)).toBe(true)
    expect(path).toBe(join(getConfigDir(), "credentials.json"))
  })

  test("storeApiKey creates file with 0600 permissions on non-Windows", () => {
    if (process.platform === "win32") return
    const path = storeApiKey(TEST_API_KEY)
    const stat = statSync(path)
    expect(stat.mode & 0o777).toBe(0o600)
  })

  test("resolveApiKey returns null when no key exists", () => {
    const result = resolveApiKey()
    expect(result).toBeNull()
  })

  test("resolveApiKey returns stored key with source=config", () => {
    storeApiKey(TEST_API_KEY)
    const result = resolveApiKey()
    expect(result).not.toBeNull()
    expect(result?.key).toBe(TEST_API_KEY)
    expect(result?.source).toBe("config")
  })

  test("resolveApiKey prioritizes flag over env and config", () => {
    storeApiKey("ok_configkey12345678901234567890123")
    process.env.OUTLIT_API_KEY = "ok_envkey12345678901234567890123456"
    const result = resolveApiKey("ok_flagkey12345678901234567890123456")
    expect(result?.key).toBe("ok_flagkey12345678901234567890123456")
    expect(result?.source).toBe("flag")
  })

  test("resolveApiKey prioritizes env over config", () => {
    storeApiKey("ok_configkey12345678901234567890123")
    process.env.OUTLIT_API_KEY = "ok_envkey12345678901234567890123456"
    const result = resolveApiKey()
    expect(result?.key).toBe("ok_envkey12345678901234567890123456")
    expect(result?.source).toBe("env")
  })

  test("resolveApiKey returns null if credentials.json is corrupted", () => {
    mkdirSync(getConfigDir(), { recursive: true })
    writeFileSync(join(getConfigDir(), "credentials.json"), "NOT JSON", { mode: 0o600 })
    const result = resolveApiKey()
    expect(result).toBeNull()
  })
})
