// mock.module() must appear before any import statements — Bun hoists it.
import { describe, expect, mock, spyOn, test } from "bun:test"

mock.module("../../../src/lib/config", () => ({
  getConfigDir: () => "/mock/config/outlit",
  resolveApiKey: () => null,
  storeApiKey: () => "/mock/config/outlit/credentials.json",
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: "ok_mockedkey",
    baseUrl: "https://app.outlit.ai",
    callTool: async () => ({ customers: [] }),
  }),
}))

import statusCmd from "../../../src/commands/auth/status"
import * as clientModule from "../../../src/lib/client"
import * as configModule from "../../../src/lib/config"
import {
  ExitError,
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
} from "../../helpers"

setNonInteractive()

describe("auth status", () => {
  test("no key — exits 1 with not_authenticated (JSON)", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue(null)
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await statusCmd.run!({
        args: { json: true, "api-key": undefined },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      resolveApiKeySpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrOutput, "not_authenticated")
  })

  test("no key — exits 1 with not_authenticated (non-json)", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue(null)
    const exitSpy = mockExitThrow()
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {})

    let thrown: unknown
    try {
      await statusCmd.run!({
        args: { json: false, "api-key": undefined },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      resolveApiKeySpy.mockRestore()
      exitSpy.mockRestore()
      consoleSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
  })

  test("valid key — exits 0 with authenticated: true", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      source: "config",
    })
    const createClientSpy = spyOn(clientModule, "createClient").mockResolvedValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      baseUrl: "https://app.outlit.ai",
      callTool: async () => ({ customers: [] }),
    })
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let stdoutOutput = ""
    try {
      await statusCmd.run!({
        args: { json: true, "api-key": undefined },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0])

      stdoutOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      resolveApiKeySpy.mockRestore()
      createClientSpy.mockRestore()
      stdoutSpy.mockRestore()
    }

    const parsed = JSON.parse(stdoutOutput) as Record<string, unknown>
    expect(parsed.authenticated).toBe(true)
    expect(parsed.source).toBe("config")
    expect(parsed.key).toBe("ok_Ab...0123")
  })

  test("valid key — interactive success output", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      source: "config",
    })
    const createClientSpy = spyOn(clientModule, "createClient").mockResolvedValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      baseUrl: "https://app.outlit.ai",
      callTool: async () => ({ customers: [] }),
    })
    const consoleSpy = spyOn(console, "log").mockImplementation(() => {})
    setInteractive()

    let loggedOutput = ""
    try {
      await statusCmd.run!({
        args: { json: false, "api-key": undefined },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0])

      loggedOutput = consoleSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      setNonInteractive()
      resolveApiKeySpy.mockRestore()
      createClientSpy.mockRestore()
      consoleSpy.mockRestore()
    }

    expect(loggedOutput).toContain("Authenticated")
    expect(loggedOutput).toContain("ok_Ab...0123")
    expect(loggedOutput).toContain("config")
  })

  test("invalid key — exits 1 with invalid_key", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      source: "env",
    })
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("API error (401): Unauthorized"),
    )
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await statusCmd.run!({
        args: { json: true, "api-key": undefined },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      resolveApiKeySpy.mockRestore()
      createClientSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrOutput, "invalid_key")
  })
})
