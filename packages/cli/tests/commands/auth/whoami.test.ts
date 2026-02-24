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

import { default as whoamiCmd } from "../../../src/commands/auth/whoami"
import * as clientModule from "../../../src/lib/client"
import * as configModule from "../../../src/lib/config"
import { ExitError, expectErrorExit, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("auth whoami", () => {
  test("no key — exits 1 with not_authenticated", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue(null)
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await whoamiCmd.run!({
        args: { json: true, "api-key": undefined },
      } as Parameters<NonNullable<typeof whoamiCmd.run>>[0])
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

  test("valid key — outputs masked key and source (JSON shape)", async () => {
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
      await whoamiCmd.run!({
        args: { json: true, "api-key": undefined },
      } as Parameters<NonNullable<typeof whoamiCmd.run>>[0])

      stdoutOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      resolveApiKeySpy.mockRestore()
      createClientSpy.mockRestore()
      stdoutSpy.mockRestore()
    }

    const parsed = JSON.parse(stdoutOutput) as Record<string, unknown>
    expect(parsed.key).toBe("ok_Ab...0123")
    expect(parsed.source).toBe("config")
    expect(parsed.valid).toBe(true)
  })

  test("valid key — outputs single line for scripting (interactive mode)", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      source: "env",
    })
    const createClientSpy = spyOn(clientModule, "createClient").mockResolvedValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      baseUrl: "https://app.outlit.ai",
      callTool: async () => ({ customers: [] }),
    })
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let stdoutOutput = ""
    try {
      await whoamiCmd.run!({
        args: { json: false, "api-key": undefined },
      } as Parameters<NonNullable<typeof whoamiCmd.run>>[0])

      stdoutOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      resolveApiKeySpy.mockRestore()
      createClientSpy.mockRestore()
      stdoutSpy.mockRestore()
    }

    expect(stdoutOutput).toContain("ok_Ab...0123")
    expect(stdoutOutput).toContain("env")
  })

  test("invalid key — exits 1 with invalid_key", async () => {
    const resolveApiKeySpy = spyOn(configModule, "resolveApiKey").mockReturnValue({
      key: "ok_AbcdefGHIJKLMNOPQRSTUVWXYZ0123",
      source: "flag",
    })
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("API error (401): Unauthorized"),
    )
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await whoamiCmd.run!({
        args: { json: true, "api-key": undefined },
      } as Parameters<NonNullable<typeof whoamiCmd.run>>[0])
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
