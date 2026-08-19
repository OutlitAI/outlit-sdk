import { describe, expect, test } from "bun:test"
import type { Resolvable } from "citty"

async function resolve<T>(value: Resolvable<T>): Promise<T> {
  if (typeof value === "function") {
    return (value as () => T | Promise<T>)()
  }

  return value
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Missing ${name} command`)
  return value
}

describe("customers command", () => {
  test("advertises and registers only the approved customer collaboration commands", async () => {
    const { default: customersCmd } = await import("../../../src/commands/customers")
    const meta = customersCmd.meta ? await resolve(customersCmd.meta) : undefined
    const description = meta?.description ?? ""
    const subCommands = customersCmd.subCommands ? await resolve(customersCmd.subCommands) : {}

    expect(Object.keys(subCommands)).toEqual([
      "list",
      "get",
      "relationship",
      "features",
      "timeline",
      "owner",
      "grant",
      "revoke",
    ])
    expect(description).toContain("owner set")
    expect(description).toContain("features")
    expect(description).toContain("grant")
    expect(description).toContain("revoke")
    expect(description).not.toContain("assign-owner")
    expect(description).not.toContain("grant-access")
    expect(description).not.toContain("update-access")
    expect(description).not.toContain("revoke-access")

    const ownerCmd = await resolve(required(subCommands.owner, "owner"))
    const ownerSubCommands = ownerCmd.subCommands ? await resolve(ownerCmd.subCommands) : {}
    expect(Object.keys(ownerSubCommands)).toEqual(["set"])

    const setCmd = await resolve(required(ownerSubCommands.set, "owner set"))
    const grantCmd = await resolve(required(subCommands.grant, "grant"))
    const revokeCmd = await resolve(required(subCommands.revoke, "revoke"))
    expect((await resolve(setCmd.meta!)).name).toBe("set")
    expect((await resolve(grantCmd.meta!)).name).toBe("grant")
    expect((await resolve(revokeCmd.meta!)).name).toBe("revoke")
  })
})
