import { describe, expect, test } from "bun:test"

describe("integrations command", () => {
  test("exposes setup/status/capabilities without legacy or destructive commands", async () => {
    const { default: integrationsCmd } = await import("../../../src/commands/integrations")
    const subcommands = Object.keys(integrationsCmd.subCommands ?? {})
    const metaSource = integrationsCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(subcommands).toContain("setup")
    expect(subcommands).toContain("status")
    expect(subcommands).toContain("capabilities")
    expect(subcommands).toContain("list")
    expect(subcommands).not.toContain("add")
    expect(subcommands).not.toContain("remove")
    expect(meta?.description).not.toContain("add <provider>")
    expect(meta?.description).not.toContain("remove <provider>")
  })
})
