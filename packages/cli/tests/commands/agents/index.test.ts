import { describe, expect, test } from "bun:test"

describe("agents command", () => {
  test("exposes template and action commands without destructive or bundle commands", async () => {
    const { default: agentsCmd } = await import("../../../src/commands/agents")
    const subcommands = Object.keys(agentsCmd.subCommands ?? {})
    const metaSource = agentsCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(subcommands).toContain("templates")
    expect(subcommands).toContain("actions")
    expect(subcommands).toContain("create-from-template")
    expect(subcommands).not.toContain("enable")
    expect(subcommands).not.toContain("install-bundle")
    expect(subcommands).not.toContain("delete")
    expect(subcommands).not.toContain("grants")
    expect(meta?.description).toContain("configuration actions")
    expect(meta?.description).not.toContain("grants")
  })
})
