import { describe, expect, spyOn, test } from "bun:test"
import { setInteractive, setNonInteractive } from "../helpers"

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
      expect(stopCall).toContain("✔")
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
      expect(failCall).toContain("✗")
      expect(failCall).toContain("something broke")
    } finally {
      stderrSpy.mockRestore()
      setNonInteractive()
    }
  })
})
