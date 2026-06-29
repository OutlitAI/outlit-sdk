import { describe, expect, test } from "bun:test"

describe("destinations command", () => {
  test("exposes read-only destination commands", async () => {
    const { default: destinationsCmd } = await import("../../../src/commands/destinations")
    const subcommands = Object.keys(destinationsCmd.subCommands ?? {})

    expect(subcommands).toEqual(["list"])
    expect(subcommands).not.toContain("create")
    expect(subcommands).not.toContain("update")
    expect(subcommands).not.toContain("delete")
    expect(subcommands).not.toContain("reveal-secret")
  })
})
