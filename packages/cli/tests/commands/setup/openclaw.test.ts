// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

const mockExistsSync = mock((_path: string) => false)
const mockWriteFileSync = mock((_path: string, _data: string) => undefined)
const mockMkdirSync = mock((_path: string, _opts?: unknown) => undefined)

mock.module("node:fs", () => ({
  existsSync: mockExistsSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}))

import type { CredentialResult } from "../../../src/lib/config"
const mockResolveApiKey = mock((_flag?: string): CredentialResult | null => ({
  key: TEST_API_KEY,
  source: "env",
}))

mock.module("../../../src/lib/config", () => ({
  resolveApiKey: mockResolveApiKey,
}))

import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { homedir } from "node:os"
import { join } from "node:path"
import { ExitError, TEST_API_KEY, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("setup openclaw", () => {
  beforeEach(() => {
    mockExistsSync.mockClear()
    mockWriteFileSync.mockClear()
    mockMkdirSync.mockClear()
    mockResolveApiKey.mockClear()
    mockExistsSync.mockImplementation((_path: string) => false)
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => ({
      key: TEST_API_KEY,
      source: "env",
    }))
  })

  test("writes SKILL.md to ~/clawd/skills/ when it exists", async () => {
    const clawdDir = join(homedir(), "clawd")
    // ~/clawd/ exists
    mockExistsSync.mockImplementation((p: string) => p === clawdDir)

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: openclawCmd } = await import("../../../src/commands/setup/openclaw")

    try {
      await openclawCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof openclawCmd.run>>[0])
    } finally {
      const calls = writeSpy.mock.calls.slice()
      writeSpy.mockRestore()

      expect(mockWriteFileSync.mock.calls.length).toBeGreaterThan(0)
      const [writtenPath, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string]

      const expectedDir = join(clawdDir, "skills", "outlit-intelligence")
      expect(writtenPath).toBe(join(expectedDir, "SKILL.md"))
      expect(writtenContent).toContain("name: outlit-intelligence")
      expect(writtenContent).toContain("outlit customers list")

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.agent).toBe("openclaw")
      expect(result.path).toBe(join(expectedDir, "SKILL.md"))
    }
  })

  test("falls back to ~/.openclaw/skills/ when ~/clawd/ doesn't exist", async () => {
    // ~/clawd/ does not exist
    mockExistsSync.mockImplementation((_path: string) => false)

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: openclawCmd } = await import("../../../src/commands/setup/openclaw")

    try {
      await openclawCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof openclawCmd.run>>[0])
    } finally {
      const calls = writeSpy.mock.calls.slice()
      writeSpy.mockRestore()

      expect(mockWriteFileSync.mock.calls.length).toBeGreaterThan(0)
      const [writtenPath] = mockWriteFileSync.mock.calls[0] as [string, string]

      const expectedDir = join(homedir(), ".openclaw", "skills", "outlit-intelligence")
      expect(writtenPath).toBe(join(expectedDir, "SKILL.md"))

      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.path).toContain(".openclaw")
    }
  })

  test("not_authenticated when no key", async () => {
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => null)

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: openclawCmd } = await import("../../../src/commands/setup/openclaw")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await openclawCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof openclawCmd.run>>[0])
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
    expect(parsed.code).toBe("not_authenticated")
  })

  test("SKILL.md content contains required sections", async () => {
    const clawdDir = join(homedir(), "clawd")
    // ~/clawd/ exists so SKILL.md goes there
    mockExistsSync.mockImplementation((p: string) => p === clawdDir)

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: openclawCmd } = await import("../../../src/commands/setup/openclaw")

    try {
      await openclawCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof openclawCmd.run>>[0])
    } finally {
      writeSpy.mockRestore()

      expect(mockWriteFileSync.mock.calls.length).toBeGreaterThan(0)
      const [, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string]

      // All CLI commands that the skill documents must be present
      expect(writtenContent).toContain("outlit customers list")
      expect(writtenContent).toContain("outlit facts")
      expect(writtenContent).toContain("outlit sql")

      // The env var reference must appear so Claude knows how to authenticate
      expect(writtenContent).toContain("OUTLIT_API_KEY")

      // The rules section must exist so Claude knows how to handle the output
      expect(writtenContent).toContain("## Rules")
    }
  })
})
