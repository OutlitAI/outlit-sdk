import { afterEach, describe, expect, spyOn, test } from "bun:test"
import type { ExitError } from "../helpers"
import { mockExitThrow, setNonInteractive } from "../helpers"

describe("outputResult()", () => {
  afterEach(() => setNonInteractive())

  test("writes JSON to stdout", async () => {
    const { outputResult } = await import("../../src/lib/output")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    outputResult({ foo: "bar" })
    expect(writeSpy).toHaveBeenCalledWith(`${JSON.stringify({ foo: "bar" }, null, 2)}\n`)
    writeSpy.mockRestore()
  })

  test("writes JSON to stdout when non-interactive (piped)", async () => {
    const { outputResult } = await import("../../src/lib/output")
    setNonInteractive()
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    outputResult({ foo: "bar" })
    expect(writeSpy).toHaveBeenCalledWith(`${JSON.stringify({ foo: "bar" }, null, 2)}\n`)
    writeSpy.mockRestore()
  })
})

describe("outputError()", () => {
  afterEach(() => setNonInteractive())

  test("writes { error: string } to stderr in JSON mode and exits 1", async () => {
    const { outputError } = await import("../../src/lib/output")
    setNonInteractive()
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      outputError({ message: "Something went wrong" }, true)
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as ExitError).code).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('"error": "Something went wrong"'),
    )

    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  test("error value in JSON is a plain string (not nested object)", async () => {
    const { outputError } = await import("../../src/lib/output")
    setNonInteractive()
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      outputError({ message: "flat message" }, true)
    } catch {}

    const written = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    const parsed = JSON.parse(written) as unknown
    expect(typeof (parsed as Record<string, unknown>).error).toBe("string")

    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })
})

describe("errorMessage()", () => {
  test("extracts message from Error instance", async () => {
    const { errorMessage } = await import("../../src/lib/output")
    expect(errorMessage(new Error("test error"), "fallback")).toBe("test error")
  })

  test("returns fallback for non-Error values", async () => {
    const { errorMessage } = await import("../../src/lib/output")
    expect(errorMessage("string thrown", "fallback")).toBe("fallback")
    expect(errorMessage(null, "fallback")).toBe("fallback")
  })
})
