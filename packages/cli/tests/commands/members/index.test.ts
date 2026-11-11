import { describe, expect, test } from "bun:test"

describe("members command", () => {
  test("uses the member command name for workspace user discovery", async () => {
    const { default: wsUsersCmd } = await import("../../../src/commands/members")
    const subcommands = Object.keys(wsUsersCmd.subCommands ?? {})
    const metaSource = wsUsersCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(meta?.name).toBe("members")
    expect(meta?.description).toContain("internal workspace members")
    expect(subcommands).toEqual(["list"])
  })
})
