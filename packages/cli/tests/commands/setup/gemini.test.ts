// mock.module() must be first statement before any imports — Bun hoists it.
import { mock } from "bun:test"

const mockExecFileSync = mock((_cmd: string, _args: string[], _opts?: unknown) => undefined)

mock.module("node:child_process", () => ({
  execFileSync: mockExecFileSync,
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

describe("setup gemini", () => {
  beforeEach(() => {
    mockExecFileSync.mockClear()
    mockResolveApiKey.mockClear()
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => ({
      key: TEST_API_KEY,
      source: "env",
    }))
    mockExecFileSync.mockImplementation(
      (_cmd: string, _args: string[], _opts?: unknown) => undefined,
    )
  })

  test("calls execFileSync with correct gemini args", async () => {
    const { default: geminiCmd } = await import("../../../src/commands/setup/gemini")

    await geminiCmd.run!({
      args: { json: false },
    } as Parameters<NonNullable<typeof geminiCmd.run>>[0])

    expect(mockExecFileSync.mock.calls.length).toBe(1)
    const [cmd, cmdArgs] = mockExecFileSync.mock.calls[0] as [string, string[]]
    expect(cmd).toBe("gemini")
    expect(cmdArgs).toContain("mcp")
    expect(cmdArgs).toContain("add")
    expect(cmdArgs).toContain("--transport")
    expect(cmdArgs).toContain("http")
    expect(cmdArgs).toContain("outlit")
    expect(cmdArgs).toContain("https://mcp.outlit.ai/mcp")
    expect(cmdArgs).toContain("--header")
    expect(cmdArgs.some((a) => a.includes("Authorization: Bearer"))).toBe(true)
    expect(cmdArgs.some((a) => a.includes(TEST_API_KEY))).toBe(true)
  })

  test("gemini_not_found when gemini not in PATH", async () => {
    const enoentError = Object.assign(new Error("spawn gemini ENOENT"), {
      code: "ENOENT",
    })
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw enoentError
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: geminiCmd } = await import("../../../src/commands/setup/gemini")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await geminiCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof geminiCmd.run>>[0])
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
    expect(parsed.code).toBe("gemini_not_found")
  })

  test("gemini_mcp_unsupported when mcp subcommand not recognized", async () => {
    const unsupportedError = new Error("mcp command is not supported")
    mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown): never => {
      throw unsupportedError
    })

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: geminiCmd } = await import("../../../src/commands/setup/gemini")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await geminiCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof geminiCmd.run>>[0])
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
    expect(parsed.code).toBe("gemini_mcp_unsupported")
  })

  test("not_authenticated when no key", async () => {
    mockResolveApiKey.mockImplementation((_flag?: string): CredentialResult | null => null)

    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const { default: geminiCmd } = await import("../../../src/commands/setup/gemini")

    let thrown: unknown
    let stderrWritten = ""
    try {
      await geminiCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof geminiCmd.run>>[0])
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
})
