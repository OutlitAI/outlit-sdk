import { describe, expect, test } from "bun:test"

describe("customers command", () => {
  test("advertises and registers customer ownership and access commands", async () => {
    const { default: customersCmd } = await import("../../../src/commands/customers")
    const metaSource = customersCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)
    const description = meta?.description ?? ""

    expect(Object.keys(customersCmd.subCommands ?? {})).toEqual([
      "list",
      "get",
      "timeline",
      "assign-owner",
      "grant-access",
      "update-access",
      "revoke-access",
    ])
    expect(description).toContain("assign-owner")
    expect(description).toContain("grant-access")
    expect(description).toContain("update-access")
    expect(description).toContain("revoke-access")
  })
})
