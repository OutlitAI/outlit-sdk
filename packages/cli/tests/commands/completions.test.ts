import { describe, expect, spyOn, test } from "bun:test"
import { expectErrorExit, mockExitThrow, setNonInteractive } from "../helpers"

setNonInteractive()

describe("completions command", () => {
  test("bash — writes completion script to stdout", async () => {
    const { default: completionsCmd } = await import("../../src/commands/completions")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await completionsCmd.run!({
        args: { shell: "bash" },
      } as Parameters<NonNullable<typeof completionsCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
    }

    expect(written).toContain("compgen")
    expect(written).toContain("outlit")
  })

  test("zsh — writes completion script to stdout", async () => {
    const { default: completionsCmd } = await import("../../src/commands/completions")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await completionsCmd.run!({
        args: { shell: "zsh" },
      } as Parameters<NonNullable<typeof completionsCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
    }

    expect(written).toContain("#compdef outlit")
    expect(written).toContain("_describe")
  })

  test("fish — writes completion script to stdout", async () => {
    const { default: completionsCmd } = await import("../../src/commands/completions")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await completionsCmd.run!({
        args: { shell: "fish" },
      } as Parameters<NonNullable<typeof completionsCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
    }

    expect(written).toContain("complete -c outlit")
  })

  test("unknown shell — exits 1", async () => {
    const { default: completionsCmd } = await import("../../src/commands/completions")
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let thrown: unknown
    let stderrOutput = ""
    try {
      await completionsCmd.run!({
        args: { shell: "powershell" },
      } as Parameters<NonNullable<typeof completionsCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrOutput = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrOutput, "unknown_shell")
  })
})
