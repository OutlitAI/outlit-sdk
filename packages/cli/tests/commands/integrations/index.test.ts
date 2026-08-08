import { describe, expect, test } from "bun:test"

describe("integrations command", () => {
  test("exposes only the setup and status integration commands", async () => {
    const { default: integrationsCmd } = await import("../../../src/commands/integrations")
    const subcommands = Object.keys(integrationsCmd.subCommands ?? {})
    const metaSource = integrationsCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(subcommands).toEqual(["setup", "status"])
    expect(meta?.description).not.toContain("capabilities")
    expect(meta?.description).not.toContain("list")
  })
})
