import { describe, expect, test } from "bun:test"

describe("automations command", () => {
  test("exposes automation read, write, and lifecycle commands", async () => {
    const { default: automationsCmd } = await import("../../../src/commands/automations")
    const subcommands = Object.keys(automationsCmd.subCommands ?? {})
    const metaSource = automationsCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(subcommands).toEqual([
      "list",
      "get",
      "options",
      "create",
      "update",
      "enable",
      "disable",
      "archive",
    ])
    expect(subcommands).not.toContain("delete")
    expect(meta?.description).toContain("List configured automations")
    expect(meta?.description).toContain("options")
  })
})
