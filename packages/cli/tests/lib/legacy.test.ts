import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { CommandDef } from "citty"
import { isHelpRequest, renamedNotice, rewriteLegacyArgs } from "../../src/lib/legacy"

const commandsDir = join(import.meta.dir, "..", "..", "src", "commands")

/** Every previously published spelling → the argument list and notice it becomes. */
const cases: Array<[string, string[], string[], string]> = [
  [
    "customers credits",
    ["customers", "credits", "acme.com"],
    ["customers", "get", "acme.com", "--include", "credits"],
    "outlit customers get <customer> --include credits",
  ],
  [
    "customers features",
    ["customers", "features", "acme.com", "--weeks", "6"],
    ["customers", "get", "acme.com", "--weeks", "6", "--include", "features,meters"],
    "outlit customers get <customer> --include features,meters",
  ],
  [
    "customers relationship",
    ["customers", "relationship", "acme.com"],
    ["customers", "get", "acme.com", "--include", "relationship"],
    "outlit customers get <customer> --include relationship",
  ],
  [
    "customers timeline",
    ["customers", "timeline", "acme.com", "--timeframe", "90d"],
    ["timeline", "get", "acme.com", "--timeframe", "90d"],
    "outlit timeline get <customer>",
  ],
  [
    "customers identity",
    ["customers", "identity", "c1", "--links"],
    ["identity", "get", "c1", "--include", "links"],
    "outlit identity get <customer>",
  ],
  [
    "customers merge-status",
    ["customers", "merge-status", "op_1"],
    ["merges", "get", "op_1"],
    "outlit merges get <id>",
  ],
  [
    "customers owner set",
    ["customers", "owner", "set", "acme.com", "--member", "u1"],
    ["customers", "set-owner", "acme.com", "--member", "u1"],
    "outlit customers set-owner <customer> --member <member>",
  ],
  [
    "customers grant",
    ["customers", "grant", "acme.com", "--target-user-id", "u1", "--role", "viewer"],
    ["customers", "set-access", "acme.com", "--member", "u1", "--role", "viewer"],
    "outlit customers set-access <customer> --member <member> --role <role>",
  ],
  [
    "customers revoke",
    ["customers", "revoke", "acme.com", "--member", "u1"],
    ["customers", "set-access", "acme.com", "--member", "u1", "--role", "none"],
    "outlit customers set-access <customer> --member <member> --role none",
  ],
  [
    "customers merge --execute",
    ["customers", "merge", "a", "b", "--execute", "--review-notes", "same", "--request-id", "r"],
    ["customers", "merge", "a", "b", "--note", "same", "--request-id", "r", "--mode", "execute"],
    "outlit customers merge <survivor> <duplicate> --mode execute",
  ],
  [
    "identity suggestions list",
    ["identity", "suggestions", "list", "--customer-id", "c1"],
    ["merge-suggestions", "list", "--customer", "c1"],
    "outlit merge-suggestions list --customer <customer>",
  ],
  [
    "identity suggestions reject",
    ["identity", "suggestions", "reject", "s1", "--review-notes=Different"],
    ["merge-suggestions", "reject", "s1", "--note=Different"],
    "outlit merge-suggestions reject <id> --note <note>",
  ],
  [
    "ws-users list",
    ["ws-users", "list", "--role", "CSM"],
    ["members", "list", "--role", "CSM"],
    "outlit members list",
  ],
  ["users list", ["users", "list"], ["people", "list"], "outlit people list"],
  ["sql", ["sql", "SELECT 1"], ["query", "SELECT 1"], "outlit query"],
  ["schema", ["schema", "activity"], ["schema", "get", "activity"], "outlit schema get"],
  ["schema (no args)", ["schema"], ["schema", "get"], "outlit schema get"],
  [
    "feedback",
    ["feedback", "--body", "x"],
    ["feedback", "submit", "--body", "x"],
    "outlit feedback submit",
  ],
  ["activation get", ["activation", "get"], ["settings", "get"], "outlit settings get"],
  [
    "activation update",
    ["activation", "update", "--event", "e"],
    ["settings", "update", "--activation-event", "e"],
    "outlit settings update --activation-event <event>",
  ],
  [
    "activation disable",
    ["activation", "disable"],
    ["settings", "update", "--activation-event", "none"],
    "outlit settings update --activation-event none",
  ],
  [
    "integrations status",
    ["integrations", "status", "stripe"],
    ["integrations", "list", "stripe"],
    "outlit integrations list",
  ],
  [
    "settings update --default-timezone",
    ["settings", "update", "--default-timezone", "Europe/Berlin"],
    ["settings", "update", "--timezone", "Europe/Berlin"],
    "outlit settings update --timezone <timezone>",
  ],
  [
    "facts get --fact-id",
    ["facts", "get", "--fact-id", "f1", "--include", "evidence"],
    ["facts", "get", "f1", "--include", "evidence"],
    "outlit facts get <fact-id>",
  ],
  [
    "sources get --source-type --source-id",
    ["sources", "get", "--source-type", "call", "--source-id=c1", "--limit", "5"],
    ["sources", "get", "call", "c1", "--limit", "5"],
    "outlit sources get <type> <id>",
  ],
  [
    "destinations get",
    ["destinations", "get", "d1"],
    ["destinations", "list", "--ids", "d1"],
    "outlit destinations list --ids <id>",
  ],
  [
    "destinations enable",
    ["destinations", "enable", "d1"],
    ["destinations", "update", "d1", "--enabled=true"],
    "outlit destinations update <id> --enabled true",
  ],
  [
    "destinations disable",
    ["destinations", "disable", "d1"],
    ["destinations", "update", "d1", "--enabled=false"],
    "outlit destinations update <id> --enabled false",
  ],
  [
    "destinations create --default --disabled",
    ["destinations", "create", "--default", "--disabled", "--label", "x"],
    ["destinations", "create", "--is-default", "--enabled=false", "--label", "x"],
    "outlit destinations create --enabled <true|false> --is-default",
  ],
  [
    "destinations update --enabled (bare)",
    ["destinations", "update", "d1", "--enabled", "--json"],
    ["destinations", "update", "d1", "--enabled=true", "--json"],
    "outlit destinations update <id> --enabled <true|false> --is-default",
  ],
  [
    "features create --source --event --key",
    ["features", "create", "--source", "s", "--event", "e", "--key", "k", "--name", "n"],
    [
      "features",
      "create",
      "--source-key",
      "s",
      "--event-name",
      "e",
      "--feature-key",
      "k",
      "--name",
      "n",
    ],
    "outlit features create --source-key <key> --event-name <event> --feature-key <key>",
  ],
]

async function subCommandNames(def: CommandDef): Promise<string[]> {
  const subs = typeof def.subCommands === "function" ? await def.subCommands() : def.subCommands
  return Object.keys(subs ?? {})
}

/** A rewritten command line must land on a command that exists in the tree. */
async function resolves(argv: string[]): Promise<boolean> {
  const [first, second] = argv
  if (!first) return false
  const group = join(commandsDir, first, "index.ts")
  if (existsSync(group)) {
    const def = (await import(group)).default as CommandDef
    return second ? (await subCommandNames(def)).includes(second) : true
  }
  return existsSync(join(commandsDir, `${first}.ts`))
}

describe("legacy spellings", () => {
  test.each(cases)("%s runs the new command", (_name, old, expected, use) => {
    expect(rewriteLegacyArgs(old)).toEqual({ argv: expected, use })
  })

  test.each(cases)("%s lands on a command that exists", async (_name, old) => {
    const rewritten = rewriteLegacyArgs(old)
    expect(rewritten).not.toBeNull()
    expect(await resolves(rewritten?.argv ?? [])).toBe(true)
  })

  test("owner set reads the previous --target-user-id", () => {
    expect(
      rewriteLegacyArgs(["customers", "owner", "set", "acme.com", "--target-user-id", "u1"])?.argv,
    ).toEqual(["customers", "set-owner", "acme.com", "--member", "u1"])
  })

  test("global options may sit between command words", () => {
    expect(rewriteLegacyArgs(["customers", "--json", "timeline", "acme.com"])?.argv).toEqual([
      "timeline",
      "get",
      "acme.com",
      "--json",
    ])
    expect(rewriteLegacyArgs(["schema", "--json", "get", "activity"])).toEqual({
      argv: ["schema", "get", "activity", "--json"],
      use: "",
    })
    expect(rewriteLegacyArgs(["schema", "--api-key", "KEY", "get", "activity"])?.argv).toEqual([
      "schema",
      "get",
      "activity",
      "--api-key",
      "KEY",
    ])
    expect(rewriteLegacyArgs(["ws-users", "--api-key=K", "list"])?.argv).toEqual([
      "members",
      "list",
      "--api-key=K",
    ])
    expect(rewriteLegacyArgs(["schema", "--json"])?.argv).toEqual(["schema", "get", "--json"])
  })

  test("destinations get finds the id past --api-key and keeps generated options before --", () => {
    expect(rewriteLegacyArgs(["destinations", "get", "--api-key", "KEY", "ID"])?.argv).toEqual([
      "destinations",
      "list",
      "--api-key",
      "KEY",
      "--ids",
      "ID",
    ])
    expect(rewriteLegacyArgs(["destinations", "disable", "--", "ID"])?.argv).toEqual([
      "destinations",
      "update",
      "--enabled=false",
      "--",
      "ID",
    ])
    expect(rewriteLegacyArgs(["customers", "credits", "--", "acme.com"])?.argv).toEqual([
      "customers",
      "get",
      "--include",
      "credits",
      "--",
      "acme.com",
    ])
  })

  test("an explicit --enabled value is the current spelling and is left alone", () => {
    expect(rewriteLegacyArgs(["destinations", "update", "d1", "--enabled", "false"])).toBeNull()
    expect(rewriteLegacyArgs(["destinations", "update", "d1", "--enabled", "FALSE"])).toBeNull()
  })

  test("the notice names the new spelling in one line", () => {
    expect(renamedNotice("outlit timeline get <customer>")).toBe(
      "Renamed: use `outlit timeline get <customer>`",
    )
  })

  test.each([
    ["customers", "get", "acme.com", "--include", "credits"],
    ["customers", "merge", "a", "b", "--mode", "execute", "--note", "n"],
    ["facts", "get", "f1"],
    ["sources", "get", "call", "c1"],
    ["settings", "update", "--timezone", "UTC"],
    ["destinations", "update", "d1", "--enabled=false"],
    ["features", "create", "--source-key", "s"],
    ["schema", "get"],
    ["feedback", "submit", "--body", "x"],
    ["people", "list"],
    ["timeline", "get", "acme.com"],
    ["merge-suggestions", "list"],
    ["integrations", "list"],
    ["tasks", "list"],
    ["doctor"],
    [],
  ])("current spelling %j is left alone", (...argv) => {
    expect(rewriteLegacyArgs(argv)).toBeNull()
  })

  test("a group's own help is not rewritten, and help requests skip the notice", () => {
    expect(rewriteLegacyArgs(["schema", "--help"])).toBeNull()
    expect(rewriteLegacyArgs(["feedback", "-h"])).toBeNull()
    expect(isHelpRequest(["ws-users", "list", "--help"])).toBe(true)
    expect(isHelpRequest(["ws-users", "list"])).toBe(false)
  })

  test("flags after -- are not renamed", () => {
    expect(
      rewriteLegacyArgs(["settings", "update", "--timezone", "UTC", "--", "--default-timezone"]),
    ).toBeNull()
  })
})
