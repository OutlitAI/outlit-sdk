import { afterEach, beforeEach, describe, expect, test } from "bun:test"

describe("isInteractive()", () => {
  let originalStdinIsTTY: boolean | undefined
  let originalStdoutIsTTY: boolean | undefined
  let originalEnv: {
    CI: string | undefined
    GITHUB_ACTIONS: string | undefined
    TERM: string | undefined
  }

  beforeEach(() => {
    originalStdinIsTTY = process.stdin.isTTY
    originalStdoutIsTTY = process.stdout.isTTY
    originalEnv = {
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      TERM: process.env.TERM,
    }
    // Reset to known baseline so tests are not affected by prior state
    setTTY(true, true)
    Reflect.deleteProperty(process.env, "CI")
    Reflect.deleteProperty(process.env, "GITHUB_ACTIONS")
    Reflect.deleteProperty(process.env, "TERM")
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalStdinIsTTY,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalStdoutIsTTY,
      writable: true,
      configurable: true,
    })
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key)
      } else {
        process.env[key] = value
      }
    }
  })

  function setTTY(stdin: boolean | undefined, stdout: boolean | undefined): void {
    Object.defineProperty(process.stdin, "isTTY", {
      value: stdin,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(process.stdout, "isTTY", {
      value: stdout,
      writable: true,
      configurable: true,
    })
  }

  test("returns true when both stdin and stdout are TTYs", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(true, true)
    expect(isInteractive()).toBe(true)
  })

  test("returns false when stdin is not a TTY", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(false, true)
    expect(isInteractive()).toBe(false)
  })

  test("returns false when stdout is not a TTY", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(true, false)
    expect(isInteractive()).toBe(false)
  })

  test("returns false when CI=true", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(true, true)
    process.env.CI = "true"
    expect(isInteractive()).toBe(false)
  })

  test("returns false when CI=1", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(true, true)
    process.env.CI = "1"
    expect(isInteractive()).toBe(false)
  })

  test("returns false when GITHUB_ACTIONS is set", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(true, true)
    process.env.GITHUB_ACTIONS = "true"
    expect(isInteractive()).toBe(false)
  })

  test("returns false when TERM=dumb", async () => {
    const { isInteractive } = await import("../../src/lib/tty")
    setTTY(true, true)
    process.env.TERM = "dumb"
    expect(isInteractive()).toBe(false)
  })
})
