// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

// --- node:fs mock ---
const mockExistsSync = mock((_path: string) => false)
const mockWriteFileSync = mock((_path: string, _data: string) => undefined)
const mockMkdirSync = mock((_path: string, _opts?: unknown) => undefined)

mock.module("node:fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mock((_path: string, _enc: string) => "{}"),
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}))

// --- node:child_process mock ---
const mockExecFileSync = mock((_cmd: string, _args: string[], _opts?: unknown) => undefined)

mock.module("node:child_process", () => ({
  execFileSync: mockExecFileSync,
}))

// --- lib/config mock ---
import type { CredentialResult } from "../../../src/lib/config"
const mockResolveApiKey = mock((_flag?: string): CredentialResult | null => ({
  key: TEST_API_KEY,
  source: "env",
}))

mock.module("../../../src/lib/config", () => ({
  resolveApiKey: mockResolveApiKey,
}))

import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { ExitError, TEST_API_KEY, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

/** Extract the last JSON object written to a spy's call list */
function lastJsonWrite(calls: unknown[][]): Record<string, unknown> {
  // Walk backwards through calls to find the last parseable JSON
  for (let i = calls.length - 1; i >= 0; i--) {
    const written = (calls[i]?.[0] as string) ?? ""
    try {
      return JSON.parse(written) as Record<string, unknown>
    } catch {
      // not JSON, skip
    }
  }
  throw new Error("No JSON write found in spy calls")
}

describe("setup auto-detect", () => {
  beforeEach(() => {
    mockExistsSync.mockClear()
    mockExecFileSync.mockClear()
    mockWriteFileSync.mockClear()
    mockMkdirSync.mockClear()
    mockResolveApiKey.mockClear()

    // Default: key found
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => ({
      key: TEST_API_KEY,
      source: "env",
    }))
    // Default: no paths exist, no commands available
    mockExistsSync.mockImplementation((_path: string) => false)
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw new Error("not found")
    })
    // Default: writeFileSync is a no-op
    mockWriteFileSync.mockImplementation((_path: string, _data: string) => undefined)
  })

  test("detects and configures cursor and claude-code when both present", async () => {
    // ~/.cursor exists (but not mcp.json or claude_desktop_config) → cursor detected
    // `which claude` succeeds → claude-code detected
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes("mcp.json")) return false
      if (path.includes("claude_desktop_config")) return false
      if (path.includes(".cursor") && !path.includes(".cursor/")) return true
      // match ~/.cursor exactly (ends with /.cursor or equals the path)
      if (/[/\\]\.cursor$/.test(path)) return true
      return false
    })
    mockExecFileSync.mockImplementation((cmd: string, args: string[], _opts?: unknown) => {
      // which claude → found; which npx → found; everything else → not found
      if (cmd === "which" && (args[0] === "claude" || args[0] === "npx")) return undefined
      // claude mcp add → succeeds
      if (cmd === "claude") return undefined
      // npx skills add → succeeds
      if (cmd === "npx") return undefined
      throw new Error("not found")
    })

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      expect(calls.length).toBeGreaterThan(0)

      // The last JSON write is the summary from the auto-detect command itself
      const result = lastJsonWrite(calls) as {
        detected: string[]
        configured: string[]
        failed: string[]
        skills: { success: boolean; runner?: string }
      }

      expect(Array.isArray(result.detected)).toBe(true)
      expect(result.detected).toContain("cursor")
      expect(result.detected).toContain("claude-code")
      // Both should be configured
      expect(result.configured).toContain("cursor")
      expect(result.configured).toContain("claude-code")
      expect(result.failed).toHaveLength(0)
      // Skills should be installed as part of batch setup
      expect(result.skills).toBeDefined()
      expect(result.skills.success).toBe(true)
      expect(result.skills.runner).toBe("npx")
    }
  })

  test("outputs empty result when no agents detected", async () => {
    // All existsSync → false, all execSync → throws (defaults set in beforeEach)

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()

      expect(calls.length).toBeGreaterThan(0)
      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as {
        detected: string[]
        configured: string[]
        failed: string[]
        skills: unknown
      }

      expect(result.detected).toHaveLength(0)
      expect(result.configured).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.skills).toBeNull()
    }
  })

  test("not_authenticated when no key", async () => {
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => null)

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } catch (e) {
      thrown = e
      // Find the last string written to stderr (the error JSON)
      const calls = stderrSpy.mock.calls
      for (let i = calls.length - 1; i >= 0; i--) {
        const call = calls[i]
        if (call && typeof call[0] === "string") {
          stderrWritten = call[0]
          break
        }
      }
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    const parsed = JSON.parse(stderrWritten) as Record<string, string>
    expect(parsed.code).toBe("not_authenticated")
  })

  test("records failed agents when subcommand throws", async () => {
    // Detect cursor by making ~/.cursor exist
    mockExistsSync.mockImplementation((path: string) => {
      // Match ~/.cursor directory (not files inside it)
      if (/[/\\]\.cursor$/.test(path)) return true
      // All other paths (mcp.json, config files, etc.) do not exist
      return false
    })
    // Make writeFileSync throw so cursor's run fails with write_error,
    // which calls outputError → process.exit(1).
    // We mock process.exit to throw ExitError; the auto-detect for-loop
    // catches that ExitError and records cursor as failed.
    mockWriteFileSync.mockImplementation((_path: string, _data: string) => {
      throw new Error("EACCES: permission denied")
    })

    const exitSpy = mockExitThrow()
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    // Suppress stderr noise from cursor's outputError
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: setupCmd } = await import("../../../src/commands/setup/index")

    try {
      await setupCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0])
    } finally {
      const calls = stdoutSpy.mock.calls.slice()
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
      // Restore writeFileSync to no-op for subsequent tests
      mockWriteFileSync.mockImplementation((_path: string, _data: string) => undefined)

      expect(calls.length).toBeGreaterThan(0)
      const result = lastJsonWrite(calls) as {
        detected: string[]
        configured: string[]
        failed: string[]
      }

      // cursor was detected
      expect(result.detected).toContain("cursor")
      // cursor failed to configure
      expect(result.failed).toContain("cursor")
      // cursor must NOT appear in configured
      expect(result.configured).not.toContain("cursor")
    }
  })
})
