import { describe, expect, test } from "bun:test"
import { type ArgsDef, type CommandDef, parseArgs } from "citty"
import { COMMANDS } from "../../src/commands/completions"
import {
  analyzeArgs,
  findArgProblem,
  formatArgProblem,
  visibleFlagNames,
} from "../../src/lib/strict-args"
import { mainCommand } from "../../src/main"

const customerId = "10000000-0000-4000-8000-000000000001"

async function problem(rawArgs: string[]) {
  return findArgProblem(mainCommand, rawArgs)
}

async function details(rawArgs: string[]) {
  const found = await problem(rawArgs)
  if (!found) throw new Error(`expected a problem for ${rawArgs.join(" ")}`)
  return formatArgProblem(found)
}

type AnyCommand = CommandDef<ArgsDef>

async function resolve<T>(value: T | (() => T | Promise<T>) | Promise<T>): Promise<T> {
  return typeof value === "function" ? (value as () => T | Promise<T>)() : value
}

/** Every runnable command in the tree with its path. */
async function leafCommands(
  command: AnyCommand = mainCommand as AnyCommand,
  path: string[] = [],
): Promise<Array<{ path: string[]; command: AnyCommand }>> {
  const subCommands = (await resolve(command.subCommands)) ?? {}
  const children = await Promise.all(
    Object.entries(subCommands).map(async ([name, child]) =>
      leafCommands((await resolve(child)) as AnyCommand, [...path, name]),
    ),
  )
  return [...(command.run ? [{ path, command }] : []), ...children.flat()]
}

describe("strict argument checking", () => {
  test("rejects the misspelled flag and stray customer from the sources list report", async () => {
    const result = await details(["sources", "list", "athenahq.ai", "--source-types", "CALL"])

    expect(result.code).toBe("unknown_flag")
    expect(result.details.command).toBe("outlit sources list")
    expect(result.details.invalid).toEqual([
      { argument: "--source-types", reason: "unknown_flag", suggestion: "--source-type" },
      {
        argument: "athenahq.ai",
        reason: "unexpected_argument",
        suggestion: "--customer athenahq.ai",
      },
    ])
    expect(result.details.validFlags).toContain("--source-type")
    expect(result.lines.join(" ")).toContain("did you mean --source-type?")
  })

  test("suggests --cursor for sources get --content-cursor", async () => {
    const result = await details([
      "sources",
      "get",
      "--source-type",
      "SLACK",
      "--source-id",
      "thread_1",
      "--content-cursor",
      "page_2",
    ])

    expect(result.details.invalid).toEqual([
      { argument: "--content-cursor", reason: "unknown_flag", suggestion: "--cursor" },
    ])
  })

  test("suggests --customer for a near-miss on users list", async () => {
    const result = await details(["users", "list", "--customerid", "athenahq.ai"])

    expect(result.details.invalid).toEqual([
      { argument: "--customerid", reason: "unknown_flag", suggestion: "--customer" },
    ])
  })

  test("rejects a positional on a command that takes none", async () => {
    const result = await details(["users", "list", "athenahq.ai"])

    expect(result.code).toBe("unexpected_argument")
    expect(result.details.invalid).toEqual([
      {
        argument: "athenahq.ai",
        reason: "unexpected_argument",
        suggestion: "--customer athenahq.ai",
      },
    ])
  })

  test("rejects a second positional and names the accepted one", async () => {
    const result = await details(["facts", "list", "acme.com", "beta.com"])

    expect(result.details.invalid).toEqual([
      { argument: "beta.com", reason: "unexpected_argument" },
    ])
    expect(result.lines.join(" ")).toContain("Positional arguments: <customer>.")
  })

  test("explains a value passed to a switch", async () => {
    const result = await details(["customers", "features", "acme.com", "--weekly", "true"])

    expect(result.details.invalid).toEqual([
      {
        argument: "true",
        reason: "unexpected_argument",
        note: "--weekly is a switch and takes no value",
      },
    ])
  })

  test("rejects a string flag without a value", async () => {
    const atEnd = await details(["sources", "list", "--customer"])
    const beforeFlag = await details(["sources", "list", "--customer", "--json"])

    for (const result of [atEnd, beforeFlag]) {
      expect(result.code).toBe("missing_input")
      expect(result.details.invalid).toEqual([{ argument: "--customer", reason: "missing_value" }])
    }
  })

  test("rejects a short flag where a value belongs; a dash value must be attached", async () => {
    for (const rawArgs of [
      ["users", "list", "--no-activity-in", "-x"],
      ["users", "list", "--search", "-draft"],
    ]) {
      const result = await details(rawArgs)
      expect(result.code).toBe("missing_input")
      expect((result.details.invalid as unknown[])[0]).toEqual({
        argument: rawArgs[2],
        reason: "missing_value",
      })
    }
    expect(await problem(["users", "list", "--search=-draft"])).toBeNull()
  })

  test("rejects unknown negations and short flags", async () => {
    expect((await details(["users", "list", "--no-bogus"])).details.invalid).toEqual([
      { argument: "--no-bogus", reason: "unknown_flag" },
    ])
    expect((await details(["users", "list", "-x"])).code).toBe("unknown_flag")
  })

  test("moves flags typed before the subcommand to the subcommand that takes them", async () => {
    expect(await analyzeArgs(mainCommand, ["--json", "customers", "list"])).toEqual({
      problem: null,
      rawArgs: ["customers", "list", "--json"],
    })
    expect(await analyzeArgs(mainCommand, ["--json", "setup", "codex"])).toEqual({
      problem: null,
      rawArgs: ["setup", "codex", "--json"],
    })
    expect(await analyzeArgs(mainCommand, ["--json", "sql", "--", "-1 query"])).toEqual({
      problem: null,
      rawArgs: ["sql", "--json", "--", "-1 query"],
    })
    // `--yes` belongs to `setup` itself, so it stays where it was typed.
    expect(await analyzeArgs(mainCommand, ["setup", "--yes", "codex"])).toEqual({
      problem: null,
      rawArgs: ["setup", "--yes", "codex"],
    })

    const unknown = await details(["--bogus", "customers", "list"])
    expect(unknown.details.command).toBe("outlit customers list")
    expect(unknown.details.invalid).toEqual([{ argument: "--bogus", reason: "unknown_flag" }])
  })

  test("a flag moved from before the subcommand never takes a value from after it", async () => {
    const result = await details(["--search", "--json", "users", "list", "acme"])

    expect(result.details.invalid).toEqual([
      { argument: "--search", reason: "missing_value" },
      { argument: "acme", reason: "unexpected_argument", suggestion: "--customer acme" },
    ])
  })

  test("rejects unknown subcommands with a suggestion", async () => {
    const result = await details(["customers", "lst"])

    expect(result.code).toBe("unknown_command")
    expect(result.details.invalid).toEqual([
      { argument: "lst", reason: "unknown_command", suggestion: "list" },
    ])
    expect(result.details.validCommands).toContain("timeline")
  })

  test("does not echo credential-looking values", async () => {
    const result = await details(["auth", "status", `ok_${"a".repeat(32)}`])

    expect(result.details.invalid).toEqual([
      { argument: "<redacted>", reason: "unexpected_argument" },
    ])
    expect(JSON.stringify(result)).not.toContain("ok_aaaa")
  })

  test.each([
    [["users", "list", "--customer", "athenahq.ai"]],
    [["users", "list", "--customer-id", customerId]],
    [["users", "list", "--customer=athenahq.ai", "--no-activity-in", "30d"]],
    [["users", "list", "--no-activity-in=30d", "--journey-stage", "ENGAGED"]],
    [["sources", "list", "--customer", "athenahq.ai", "--source-type", "CALL"]],
    [["sources", "list", "--source-type", "CALL", "--has-transcript"]],
    [["sources", "get", "--source-type", "SLACK", "--source-id", "thread_1", "--cursor", "c"]],
    [["customers", "get", "acme.com", "--include", "users", "--json"]],
    [["customers", "get", "--customer", "acme.com"]],
    [["customers", "timeline", "acme.com", "--no-json"]],
    [["customers", "features", "--weekly", "acme.com"]],
    [["facts", "list", "--customer-id", "acme.com"]],
    [["search", "pricing objections", "--customer", "acme.com"]],
    [["sql", "--", "-1 is a weird query"]],
    [["setup", "--yes"]],
    [["setup", "codex", "--json"]],
    [["integrations", "setup", "pylon", "--config", "secret"]],
    [["customers", "--help"]],
    [["sources", "list", "--bogus", "-h"]],
    [["--version"]],
    [[]],
  ])("accepts %j", async (rawArgs) => {
    expect(await problem(rawArgs)).toBeNull()
  })

  test("never lists compatibility flags as valid", async () => {
    const result = await details(["users", "list", "--bogus"])

    expect(result.details.validFlags).toContain("--customer")
    expect(result.details.validFlags).not.toContain("--customer-id")
  })

  test("every declared flag is accepted and parsed into its own value", async () => {
    for (const { path, command } of await leafCommands()) {
      const args = await resolve(command.args ?? {})
      // Each flag is parsed alone, so drop positionals and citty's required checks.
      const flags: ArgsDef = Object.fromEntries(
        Object.entries(args)
          .filter(([, def]) => def.type !== "positional")
          .map(([name, def]) => [name, { ...def, required: false }]),
      )
      for (const [name, def] of Object.entries(flags)) {
        const value = def.type === "boolean" ? [] : ["value"]
        const rawArgs = [...path, `--${name}`, ...value]
        expect({ rawArgs, problem: await problem(rawArgs) }).toEqual({ rawArgs, problem: null })

        // The camelCase spelling citty also accepted is rewritten to the declared flag.
        const camel = name.replace(/-([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase())
        if (camel !== name && path.join(" ") !== "integrations setup") {
          const analyzed = await analyzeArgs(mainCommand, [...path, `--${camel}`, ...value])
          expect(analyzed).toEqual({ problem: null, rawArgs })
        }

        // citty strips every `--no-*` token; commands read `--no-activity-in` from rawArgs.
        if (name.startsWith("no-")) continue
        const parsed: Record<string, unknown> = parseArgs([`--${name}`, ...value], flags)
        expect({ flag: rawArgs.join(" "), parsed: parsed[name] }).toEqual({
          flag: rawArgs.join(" "),
          parsed: def.type === "boolean" ? true : "value",
        })
      }
    }
  })

  test("keeps camelCase spellings working by rewriting them to the declared flag", async () => {
    const analyzed = await analyzeArgs(mainCommand, [
      "customers",
      "list",
      "--orderBy",
      "name",
      "--apiKey=key",
    ])

    expect(analyzed).toEqual({
      problem: null,
      rawArgs: ["customers", "list", "--order-by", "name", "--api-key=key"],
    })
    // citty itself kept the default for `--orderBy name`; the rewritten flag carries the value.
    const { default: list } = await import("../../src/commands/customers/list")
    const args = await resolve(list.args ?? {})
    const parse = (raw: string[]): unknown => parseArgs(raw, args)["order-by"]
    expect(parse(["--orderBy", "name"])).toBe("last_activity_at")
    expect(parse(["--order-by", "name"])).toBe("name")
  })

  test("never advertises camelCase spellings", async () => {
    const result = await details(["customers", "list", "--bogus"])

    expect(result.details.validFlags).toContain("--order-by")
    expect(result.details.validFlags).not.toContain("--orderBy")
  })
})

describe("shell completions", () => {
  test("list exactly the flags each command advertises", async () => {
    type Entry = (typeof COMMANDS)[number]
    const mismatches: string[] = []

    async function compare(entries: readonly Entry[], parent: AnyCommand, path: string[]) {
      const subCommands = (await resolve(parent.subCommands)) ?? {}
      expect(entries.map((entry) => entry.name).sort()).toEqual(Object.keys(subCommands).sort())

      for (const entry of entries) {
        const child = (await resolve(subCommands[entry.name])) as AnyCommand
        const advertised = (await visibleFlagNames(child)).sort()
        const completed = (entry.flags ?? []).map((flag) => flag.name).sort()
        if (JSON.stringify(advertised) !== JSON.stringify(completed)) {
          mismatches.push(`${[...path, entry.name].join(" ")}: ${completed} != ${advertised}`)
        }
        if (entry.subs) await compare(entry.subs, child, [...path, entry.name])
      }
    }

    await compare(COMMANDS, mainCommand as AnyCommand, [])
    expect(mismatches).toEqual([])
  })
})

async function runCli(args: string[]) {
  const proc = Bun.spawn(["bun", `${import.meta.dir}/../../src/cli.ts`, ...args], {
    env: {
      ...process.env,
      OUTLIT_NO_UPDATE_NOTIFIER: "1",
      NO_COLOR: "1",
      // A request that reached the network would fail on this unroutable origin.
      OUTLIT_API_URL: "https://outlit.invalid",
      OUTLIT_API_KEY: `ok_${"a".repeat(32)}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe("CLI entry", () => {
  test("piped output gets a JSON error on stderr and exit 1 before any request", async () => {
    const result = await runCli(["sources", "list", "athenahq.ai", "--source-types", "CALL"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const error = JSON.parse(result.stderr) as Record<string, unknown>
    expect(error.code).toBe("unknown_flag")
    expect(error.error).toContain("unknown flag --source-types (did you mean --source-type?)")
    expect(error.error).toContain('unexpected argument "athenahq.ai"')
    expect(error.invalid).toHaveLength(2)
  })

  test("help advertises --customer and hides the --customer-id alias", async () => {
    const users = await runCli(["users", "list", "--help"])
    const get = await runCli(["customers", "get", "--help"])

    expect(users.exitCode).toBe(0)
    expect(users.stdout).toContain("--customer")
    expect(users.stdout).not.toContain("--customer-id")
    expect(get.stdout).toContain("[CUSTOMER]")
    expect(get.stdout).not.toContain("CUSTOMERPOSITIONAL")
    expect(get.stdout).not.toContain("--customer-id")
  })
})
