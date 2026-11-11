/**
 * Previously published command and flag spellings, kept as hidden aliases until 2026-12-11.
 *
 * The aliases live here, in front of the command tree, rather than as commands of their own: an old
 * spelling is rewritten to the new command line before it is parsed, so it runs the new command
 * exactly and never appears in help or shell completions. Each rewrite prints one line to stderr
 * naming the new spelling.
 */

export interface LegacyRewrite {
  /** The arguments to run instead (the command words first). */
  argv: string[]
  /** The new spelling to name in the one-line notice, e.g. `outlit timeline get <customer>`. */
  use: string
}

type Rule = {
  /** Command words that select this rule. */
  from: readonly string[]
  /** Rewrites the arguments after those words; returns the new command words and arguments. */
  to: (rest: string[]) => string[]
  use: string
}

const isHelp = (arg: string | undefined) => arg === "--help" || arg === "-h"

/** Reads and removes `--flag value` / `--flag=value`; the value is "" when it is missing. */
function takeFlag(args: string[], flag: string): { value: string | undefined; rest: string[] } {
  const rest: string[] = []
  let value: string | undefined
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === "--") {
      rest.push(...args.slice(i))
      break
    }
    if (arg === `--${flag}`) {
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith("--")) {
        value = next
        i++
      } else value = ""
    } else if (arg.startsWith(`--${flag}=`)) value = arg.slice(flag.length + 3)
    else rest.push(arg)
  }
  return { value, rest }
}

/** Reads and removes a flag that takes no value. */
function takeSwitch(args: string[], flag: string): { present: boolean; rest: string[] } {
  const rest = args.filter((arg) => arg !== `--${flag}`)
  return { present: rest.length !== args.length, rest }
}

/** Renames `--old` to `--new` (with or without `=value`) wherever it appears before `--`. */
function renameFlags(args: string[], renames: Record<string, string>): string[] {
  let afterDashes = false
  return args.map((arg) => {
    if (afterDashes) return arg
    if (arg === "--") {
      afterDashes = true
      return arg
    }
    for (const [from, to] of Object.entries(renames)) {
      if (arg === `--${from}`) return `--${to}`
      if (arg.startsWith(`--${from}=`)) return `--${to}${arg.slice(from.length + 2)}`
    }
    return arg
  })
}

/** Puts a value that used to be a flag in front, as a positional. */
function flagToPositional(args: string[], flags: string[]): string[] {
  let rest = args
  const values: string[] = []
  for (const flag of flags) {
    const taken = takeFlag(rest, flag)
    rest = taken.rest
    if (taken.value) values.push(taken.value)
  }
  return [...values, ...rest]
}

/** Appends generated options before a `--` terminator, so they stay options. */
function withExtra(rest: string[], extra: string[]): string[] {
  const dashes = rest.indexOf("--")
  if (dashes === -1) return [...rest, ...extra]
  return [...rest.slice(0, dashes), ...extra, ...rest.slice(dashes)]
}

/** Global options that may sit between command words: `--json`, `--yes`, `--api-key <key>`. */
function skipGlobalOptions(argv: readonly string[], start: number): number {
  let i = start
  while (i < argv.length) {
    const arg = argv[i] as string
    if (arg === "--json" || arg === "--yes" || arg.startsWith("--api-key=")) i++
    else if (arg === "--api-key") i += 2
    else break
  }
  return i
}

/** The first positional of an argument list, skipping the value of `--api-key`. */
function firstPositional(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === "--") return args[i + 1]
    if (arg === "--api-key") i++
    else if (!arg.startsWith("-")) return arg
  }
  return undefined
}

const rules: Rule[] = [
  // Customer sections that became `customers get --include`.
  ...(["credits", "features", "relationship"] as const).map(
    (section): Rule => ({
      from: ["customers", section],
      to: (rest) => [
        "customers",
        "get",
        ...withExtra(rest, ["--include", section === "features" ? "features,meters" : section]),
      ],
      use: `outlit customers get <customer> --include ${section === "features" ? "features,meters" : section}`,
    }),
  ),
  {
    from: ["customers", "timeline"],
    to: (rest) => ["timeline", "get", ...rest],
    use: "outlit timeline get <customer>",
  },
  {
    from: ["customers", "identity"],
    to: (rest) => {
      const links = takeSwitch(rest, "links")
      return [
        "identity",
        "get",
        ...withExtra(links.rest, links.present ? ["--include", "links"] : []),
      ]
    },
    use: "outlit identity get <customer>",
  },
  {
    from: ["customers", "merge-status"],
    to: (rest) => ["merges", "get", ...rest],
    use: "outlit merges get <id>",
  },
  {
    from: ["customers", "owner", "set"],
    to: (rest) => ["customers", "set-owner", ...renameFlags(rest, { "target-user-id": "member" })],
    use: "outlit customers set-owner <customer> --member <member>",
  },
  {
    from: ["customers", "grant"],
    to: (rest) => ["customers", "set-access", ...renameFlags(rest, { "target-user-id": "member" })],
    use: "outlit customers set-access <customer> --member <member> --role <role>",
  },
  {
    from: ["customers", "revoke"],
    to: (rest) => [
      "customers",
      "set-access",
      ...withExtra(renameFlags(rest, { "target-user-id": "member" }), ["--role", "none"]),
    ],
    use: "outlit customers set-access <customer> --member <member> --role none",
  },
  {
    from: ["customers", "merge"],
    to: (rest) => {
      const execute = takeSwitch(rest, "execute")
      return [
        "customers",
        "merge",
        ...withExtra(
          renameFlags(execute.rest, { "review-notes": "note" }),
          execute.present ? ["--mode", "execute"] : [],
        ),
      ]
    },
    use: "outlit customers merge <survivor> <duplicate> --mode execute",
  },
  {
    from: ["identity", "suggestions", "list"],
    to: (rest) => [
      "merge-suggestions",
      "list",
      ...renameFlags(rest, { "customer-id": "customer" }),
    ],
    use: "outlit merge-suggestions list --customer <customer>",
  },
  {
    from: ["identity", "suggestions", "reject"],
    to: (rest) => ["merge-suggestions", "reject", ...renameFlags(rest, { "review-notes": "note" })],
    use: "outlit merge-suggestions reject <id> --note <note>",
  },
  {
    from: ["ws-users"],
    to: (rest) => ["members", ...rest],
    use: "outlit members list",
  },
  {
    from: ["users"],
    to: (rest) => ["people", ...rest],
    use: "outlit people list",
  },
  {
    from: ["sql"],
    to: (rest) => ["query", ...rest],
    use: "outlit query",
  },
  {
    from: ["activation", "get"],
    to: (rest) => ["settings", "get", ...rest],
    use: "outlit settings get",
  },
  {
    from: ["activation", "update"],
    to: (rest) => ["settings", "update", ...renameFlags(rest, { event: "activation-event" })],
    use: "outlit settings update --activation-event <event>",
  },
  {
    from: ["activation", "disable"],
    to: (rest) => ["settings", "update", ...withExtra(rest, ["--activation-event", "none"])],
    use: "outlit settings update --activation-event none",
  },
  {
    from: ["integrations", "status"],
    to: (rest) => ["integrations", "list", ...rest],
    use: "outlit integrations list",
  },
  {
    from: ["settings", "update"],
    to: (rest) => ["settings", "update", ...renameFlags(rest, { "default-timezone": "timezone" })],
    use: "outlit settings update --timezone <timezone>",
  },
  {
    from: ["facts", "get"],
    to: (rest) => ["facts", "get", ...flagToPositional(rest, ["fact-id"])],
    use: "outlit facts get <fact-id>",
  },
  {
    from: ["sources", "get"],
    to: (rest) => ["sources", "get", ...flagToPositional(rest, ["source-type", "source-id"])],
    use: "outlit sources get <type> <id>",
  },
  {
    from: ["destinations", "get"],
    to: (rest) => {
      const id = firstPositional(rest)
      const at = id === undefined ? -1 : rest.indexOf(id)
      const others = at === -1 ? rest : [...rest.slice(0, at), ...rest.slice(at + 1)]
      return [
        "destinations",
        "list",
        ...withExtra(
          others.filter((a) => a !== "--" || at === -1),
          id ? ["--ids", id] : [],
        ),
      ]
    },
    use: "outlit destinations list --ids <id>",
  },
  ...(["enable", "disable"] as const).map(
    (verb): Rule => ({
      from: ["destinations", verb],
      to: (rest) => [
        "destinations",
        "update",
        ...withExtra(rest, [`--enabled=${verb === "enable"}`]),
      ],
      use: `outlit destinations update <id> --enabled ${verb === "enable"}`,
    }),
  ),
  {
    from: ["destinations", "create"],
    to: (rest) => ["destinations", "create", ...destinationFlags(rest)],
    use: "outlit destinations create --enabled <true|false> --is-default",
  },
  {
    from: ["destinations", "update"],
    to: (rest) => ["destinations", "update", ...destinationFlags(rest)],
    use: "outlit destinations update <id> --enabled <true|false> --is-default",
  },
  {
    from: ["features", "create"],
    to: (rest) => [
      "features",
      "create",
      ...renameFlags(rest, {
        source: "source-key",
        event: "event-name",
        key: "feature-key",
      }),
    ],
    use: "outlit features create --source-key <key> --event-name <event> --feature-key <key>",
  },
]

/** The old `--default`, `--enabled` and `--disabled` of the destinations commands, as the new flags. */
function destinationFlags(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === "--default") out.push("--is-default")
    else if (arg === "--disabled") out.push("--enabled=false")
    else if (arg === "--enabled") {
      // A bare --enabled meant true. An explicit value is the current spelling: leave it alone.
      const next = args[i + 1]
      if (next !== undefined && /^(true|false)$/i.test(next)) {
        out.push(arg, next)
        i++
      } else out.push("--enabled=true")
    } else out.push(arg)
  }
  return out
}

/** Verb-less commands that gained a verb: the old command ran directly. */
const addVerb: Array<{ command: string; verb: string }> = [
  { command: "schema", verb: "get" },
  { command: "feedback", verb: "submit" },
]

/**
 * Rewrites an old spelling to the current one, or returns null when the arguments are current.
 * `outlit schema` and `outlit feedback` ran directly; they gained `get` and `submit`.
 */
/**
 * Moves global options that sit among the leading command words (`schema --api-key K get`) to the
 * end, where the command parses them; citty would take the option's value for a subcommand.
 */
function hoistGlobalOptions(argv: readonly string[]): string[] {
  const words: string[] = []
  const hoisted: string[] = []
  let i = 0
  while (i < argv.length && words.length < 3) {
    const next = skipGlobalOptions(argv, i)
    hoisted.push(...argv.slice(i, next))
    i = next
    const arg = argv[i]
    if (arg === undefined || arg.startsWith("-")) break
    words.push(arg)
    i++
  }
  // Hoisted options come before the rest, so a later option (and a `--` terminator) keeps its place.
  return [...words, ...hoisted, ...argv.slice(i)]
}

export function rewriteLegacyArgs(input: readonly string[]): LegacyRewrite | null {
  const argv = hoistGlobalOptions(input)
  const result = rewriteCommand(argv)
  if (result) return result
  return argv.join("\0") === input.join("\0") ? null : { argv, use: "" }
}

function rewriteCommand(argv: readonly string[]): LegacyRewrite | null {
  for (const { command, verb } of addVerb) {
    if (argv[0] !== command) continue
    const next = argv[skipGlobalOptions(argv, 1)]
    if (next !== verb && !isHelp(next)) {
      return { argv: [command, verb, ...argv.slice(1)], use: `outlit ${command} ${verb}` }
    }
  }

  for (const rule of rules) {
    // Command words may be separated by global options (`customers --json timeline acme.com`).
    let index = 0
    const skipped: string[] = []
    let matched = true
    for (const word of rule.from) {
      const start = index
      index = skipGlobalOptions(argv, index)
      skipped.push(...argv.slice(start, index))
      if (argv[index] !== word) {
        matched = false
        break
      }
      index++
    }
    if (!matched) continue
    const rest = [...skipped, ...argv.slice(index)]
    const rewritten = rule.to(rest)
    // A rule that changes nothing (a flag-only rule) is a notice only when the old flag was used.
    if (rewritten.join("\0") === [...rule.from, ...rest].join("\0")) continue
    return { argv: rewritten, use: rule.use }
  }

  return null
}

/** True for the arguments of a help request, which should not print the notice. */
export function isHelpRequest(argv: readonly string[]): boolean {
  return argv.some(isHelp)
}

/** The one-line notice for a rewritten command. */
export function renamedNotice(use: string): string {
  return `Renamed: use \`${use}\``
}
