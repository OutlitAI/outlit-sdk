import { describe, expect, test } from "bun:test"

describe("agents command", () => {
  test("exposes agent read, template, and lifecycle commands", async () => {
    const { default: agentsCmd } = await import("../../../src/commands/agents")
    const subcommands = Object.keys(agentsCmd.subCommands ?? {})
    const metaSource = agentsCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(subcommands).toContain("templates")
    expect(subcommands).toContain("actions")
    expect(subcommands).toContain("list")
    expect(subcommands).toContain("get")
    expect(subcommands).toContain("create-from-template")
    expect(subcommands).toContain("enable")
    expect(subcommands).toContain("disable")
    expect(subcommands).toContain("rename")
    expect(subcommands).not.toContain("install-bundle")
    expect(subcommands).not.toContain("delete")
    expect(subcommands).not.toContain("grants")
    expect(meta?.description).toContain("configuration actions")
    expect(meta?.description).not.toContain("grants")
  })
})
