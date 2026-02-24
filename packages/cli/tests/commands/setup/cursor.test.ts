// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

const mockExistsSync = mock((_path: string) => false)
const mockReadFileSync = mock((_path: string, _enc: string) => "{}")
const mockWriteFileSync = mock((_path: string, _data: string) => undefined)
const mockMkdirSync = mock((_path: string, _opts?: unknown) => undefined)

mock.module("node:fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
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
import { ExitError, TEST_API_KEY, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("setup cursor", () => {
  beforeEach(() => {
    mockExistsSync.mockClear()
    mockReadFileSync.mockClear()
    mockWriteFileSync.mockClear()
    mockMkdirSync.mockClear()
    mockResolveApiKey.mockClear()
    mockExistsSync.mockImplementation((_path: string) => false)
    mockWriteFileSync.mockImplementation((_path: string, _data: string) => undefined)
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => ({
      key: TEST_API_KEY,
      source: "env",
    }))
  })

  test("writes config to new file when no existing mcp.json", async () => {
    mockExistsSync.mockImplementation((_path: string) => false)

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: cursorCmd } = await import("../../../src/commands/setup/cursor")

    try {
      await cursorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof cursorCmd.run>>[0])
    } finally {
      const calls = writeSpy.mock.calls.slice()
      writeSpy.mockRestore()

      // Verify writeFileSync was called with correct content
      expect(mockWriteFileSync.mock.calls.length).toBeGreaterThan(0)
      const [writtenPath, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string]
      expect(writtenPath).toContain("mcp.json")
      const parsed = JSON.parse(writtenContent) as Record<string, unknown>
      const servers = parsed.mcpServers as Record<string, unknown>
      expect(servers).toBeDefined()
      expect(servers.outlit).toBeDefined()
      const outlit = servers.outlit as Record<string, unknown>
      expect(outlit.url).toBe("https://mcp.outlit.ai/mcp")
      const headers = outlit.headers as Record<string, string>
      expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)

      // Verify JSON success output
      const written = (calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.agent).toBe("cursor")
    }
  })

  test("merges into existing mcp.json preserving other servers", async () => {
    const existingConfig = JSON.stringify({
      mcpServers: {
        "other-server": {
          url: "https://other.example.com/mcp",
        },
      },
    })

    mockExistsSync.mockImplementation((_path: string) => true)
    mockReadFileSync.mockImplementation((_path: string, _enc: string) => existingConfig)

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const { default: cursorCmd } = await import("../../../src/commands/setup/cursor")

    try {
      await cursorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof cursorCmd.run>>[0])
    } finally {
      writeSpy.mockRestore()

      expect(mockWriteFileSync.mock.calls.length).toBeGreaterThan(0)
      const [, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string]
      const parsed = JSON.parse(writtenContent) as Record<string, unknown>
      const servers = parsed.mcpServers as Record<string, unknown>

      // Both servers should be present
      expect(servers["other-server"]).toBeDefined()
      expect(servers.outlit).toBeDefined()

      const outlit = servers.outlit as Record<string, unknown>
      expect(outlit.url).toBe("https://mcp.outlit.ai/mcp")
    }
  })

  test("not_authenticated when no key", async () => {
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => null)

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: cursorCmd } = await import("../../../src/commands/setup/cursor")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await cursorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof cursorCmd.run>>[0])
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

  test("write_error when writeFileSync throws", async () => {
    mockExistsSync.mockImplementation((_path: string) => false)
    mockWriteFileSync.mockImplementation((_path: string, _data: string) => {
      throw new Error("EACCES: permission denied")
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: cursorCmd } = await import("../../../src/commands/setup/cursor")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await cursorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof cursorCmd.run>>[0])
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
    expect(parsed.code).toBe("write_error")
  })
})
