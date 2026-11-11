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

    expect(Object.keys(subCommands)).toEqual(["list", "get", "merge", "set-owner", "set-access"])
    expect(description).toContain("set-owner")
    expect(description).toContain("set-access")
    expect(description).toContain("features")
    expect(description).toContain("credits")
    expect(description).not.toContain("assign-owner")
    expect(description).not.toContain("grant-access")
    expect(description).not.toContain("update-access")
    expect(description).not.toContain("revoke-access")

    const ownerCmd = await resolve(required(subCommands["set-owner"], "set-owner"))
    const accessCmd = await resolve(required(subCommands["set-access"], "set-access"))
    expect((await resolve(ownerCmd.meta!)).name).toBe("set-owner")
    expect((await resolve(accessCmd.meta!)).name).toBe("set-access")
  })
})
