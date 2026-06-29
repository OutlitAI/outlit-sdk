import { describe, expect, test } from "bun:test"

describe("destinations command", () => {
  test("exposes destination read, write, and lifecycle commands", async () => {
    const { default: destinationsCmd } = await import("../../../src/commands/destinations")
    const subcommands = Object.keys(destinationsCmd.subCommands ?? {})

    expect(subcommands).toEqual(["list", "get", "create", "update", "enable", "disable", "archive"])
    expect(subcommands).not.toContain("create-webhook")
    expect(subcommands).not.toContain("delete")
    expect(subcommands).not.toContain("reveal-secret")
  })
})
