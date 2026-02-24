// mock.module() must appear before any import statements — Bun hoists it.
import { describe, expect, mock, spyOn, test } from "bun:test"
import * as fs from "node:fs"

mock.module("../../../src/lib/config", () => ({
  getConfigDir: () => "/mock/config/outlit",
  resolveApiKey: () => null,
  storeApiKey: () => "/mock/config/outlit/credentials.json",
}))

import { default as logoutCmd } from "../../../src/commands/auth/logout"
import { ExitError, mockExitThrow, setNonInteractive } from "../../helpers"

setNonInteractive()

describe("logout", () => {
  test("logout — no credentials file (idempotent)", async () => {
    const rmSpy = spyOn(fs, "rmSync").mockImplementation(() => undefined)
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await logoutCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof logoutCmd.run>>[0])

      written = (stdoutSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      rmSpy.mockRestore()
      stdoutSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.success).toBe(true)
  })

  test("logout — removes credentials file", async () => {
    const rmSpy = spyOn(fs, "rmSync").mockImplementation(() => undefined)
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let calledPath = ""
    let calledOpts: unknown = undefined
    try {
      await logoutCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof logoutCmd.run>>[0])

      const call = rmSpy.mock.calls[0] as [string, { force: boolean }]
      calledPath = call[0]
      calledOpts = call[1]
    } finally {
      rmSpy.mockRestore()
      stdoutSpy.mockRestore()
    }

    expect(calledPath).toBe("/mock/config/outlit/credentials.json")
    expect(calledOpts).toEqual({ force: true })
  })

  test("logout — warns about OUTLIT_API_KEY env var", async () => {
    process.env.OUTLIT_API_KEY = "ok_test_env_key_1234567890123456"
    const rmSpy = spyOn(fs, "rmSync").mockImplementation(() => undefined)
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let stderrWritten = ""
    try {
      await logoutCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof logoutCmd.run>>[0])

      stderrWritten = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
      rmSpy.mockRestore()
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expect(stderrWritten).toContain(
      "Warning: OUTLIT_API_KEY env var is still set and will continue to work after logout.",
    )
  })

  test("logout — surfaces non-ENOENT errors as unlink_error", async () => {
    const acError = Object.assign(new Error("Permission denied"), { code: "EACCES" })
    const rmSpy = spyOn(fs, "rmSync").mockImplementation(() => {
      throw acError
    })
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrOutput = ""
    try {
      await logoutCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof logoutCmd.run>>[0])
    } catch (e) {
      thrown = e
      // Capture calls before mockRestore() clears them
      stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
    } finally {
      rmSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrOutput).toContain('"error"')
    expect(stderrOutput).toContain("Permission denied")
    expect(stderrOutput).toContain('"unlink_error"')
  })
})
