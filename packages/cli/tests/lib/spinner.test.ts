import { describe, expect, spyOn, test } from "bun:test"
import { isUnicodeSupported } from "../../src/lib/tty"
import { setInteractive, setNonInteractive } from "../helpers"

const SUCCESS_CHAR = isUnicodeSupported ? String.fromCodePoint(0x2713) : String.fromCodePoint(0x221a)
const FAIL_CHAR = isUnicodeSupported ? String.fromCodePoint(0x2717) : "x"

describe("createSpinner", () => {
  test("returns no-op spinner in non-interactive mode", async () => {
    setNonInteractive()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      const { createSpinner } = await import("../../src/lib/spinner")
      const spinner = createSpinner("loading...")
      spinner.update("still loading")
      spinner.stop("done")

      // No stderr writes should have occurred (no-op)
      expect(stderrSpy).not.toHaveBeenCalled()
    } finally {
      stderrSpy.mockRestore()
    }
  })

  test("stop writes checkmark to stderr in interactive mode", async () => {
    setInteractive()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      const { createSpinner } = await import("../../src/lib/spinner")
      const spinner = createSpinner("loading...")

      // Let one frame render
      await new Promise((r) => setTimeout(r, 100))
      spinner.stop("completed")

      const calls = stderrSpy.mock.calls.map((c) => c[0] as string)
      const stopCall = calls.at(-1) ?? ""
      expect(stopCall).toContain(SUCCESS_CHAR)
      expect(stopCall).toContain("completed")
    } finally {
      stderrSpy.mockRestore()
      setNonInteractive()
    }
  })

  test("fail writes X to stderr in interactive mode", async () => {
    setInteractive()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      const { createSpinner } = await import("../../src/lib/spinner")
      const spinner = createSpinner("loading...")
      spinner.fail("something broke")

      const calls = stderrSpy.mock.calls.map((c) => c[0] as string)
      const failCall = calls.at(-1) ?? ""
      expect(failCall).toContain(FAIL_CHAR)
      expect(failCall).toContain("something broke")
    } finally {
      stderrSpy.mockRestore()
      setNonInteractive()
    }
  })

  test("double stop is safe (no duplicate output)", async () => {
    setInteractive()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      const { createSpinner } = await import("../../src/lib/spinner")
      const spinner = createSpinner("loading...")
      spinner.stop("first")
      spinner.stop("second")
      spinner.fail("third")

      const calls = stderrSpy.mock.calls.map((c) => c[0] as string)
      // Only one finish line should contain the success symbol
      const finishLines = calls.filter((c) => c.includes(SUCCESS_CHAR) || c.includes(FAIL_CHAR))
      expect(finishLines).toHaveLength(1)
      expect(finishLines[0]).toContain("first")
    } finally {
      stderrSpy.mockRestore()
      setNonInteractive()
    }
  })
})
