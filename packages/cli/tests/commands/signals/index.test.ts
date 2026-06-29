import { describe, expect, test } from "bun:test"

describe("signals command", () => {
  test("exposes signal read and lifecycle commands", async () => {
    const { default: signalsCmd } = await import("../../../src/commands/signals")
    const subcommands = Object.keys(signalsCmd.subCommands ?? {})

    expect(subcommands).toEqual(["list", "get", "archive"])
    expect(subcommands).not.toContain("create")
    expect(subcommands).not.toContain("update")
    expect(subcommands).not.toContain("delete")
  })
})
