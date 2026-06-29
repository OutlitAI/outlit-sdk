import { describe, expect, test } from "bun:test"

describe("signals command", () => {
  test("exposes read-only signal commands", async () => {
    const { default: signalsCmd } = await import("../../../src/commands/signals")
    const subcommands = Object.keys(signalsCmd.subCommands ?? {})

    expect(subcommands).toEqual(["list"])
    expect(subcommands).not.toContain("create")
    expect(subcommands).not.toContain("update")
    expect(subcommands).not.toContain("delete")
  })
})
