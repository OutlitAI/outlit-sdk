import { describe, expect, test } from "bun:test"

describe("ws-users command", () => {
  test("uses the short command name for workspace user discovery", async () => {
    const { default: wsUsersCmd } = await import("../../../src/commands/ws-users")
    const subcommands = Object.keys(wsUsersCmd.subCommands ?? {})
    const metaSource = wsUsersCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(meta?.name).toBe("ws-users")
    expect(meta?.description).toContain("internal workspace users")
    expect(subcommands).toEqual(["list"])
  })
})
