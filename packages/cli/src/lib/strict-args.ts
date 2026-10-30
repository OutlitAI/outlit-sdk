import type { ArgDef, ArgsDef, CommandDef, PositionalArgDef } from "citty"
import { renderUsage } from "citty"
import { isJsonMode, outputError } from "./output"

type Resolvable<T> = T | Promise<T> | (() => T) | (() => Promise<T>)
type AnyCommand = CommandDef<any>

async function resolveValue<T>(input: Resolvable<T>): Promise<T> {
  return typeof input === "function" ? (input as () => T | Promise<T>)() : input
}

async function resolveArgs(command: AnyCommand): Promise<ArgsDef> {
  return resolveValue<ArgsDef>(command.args ?? {})
}

const hiddenArgDefs = new WeakSet<object>()
const positionalLabels = new WeakMap<object, string>()
const selfCheckedCommands = new WeakSet<object>()

/**
 * Marks a flag as a compatibility spelling: it still parses, but help, error suggestions and
 * completions advertise only the preferred flag.
 */
export function hiddenArg<const T extends ArgDef>(def: T): T {
  hiddenArgDefs.add(def)
  return def
}

/**
 * Shows a positional under `label` in help and errors. Use it when the positional's key has to
 * differ from a flag with the same human name (for example `<customer>` and `--customer`).
 */
export function labeledPositional<const T extends PositionalArgDef>(label: string, def: T): T {
  positionalLabels.set(def, label)
  return def
}

/**
 * Opts a command out of the generic check because it rejects unsupported input itself, for
 * example without echoing values that may be secrets.
 */
export function checksOwnArgs<T extends AnyCommand>(command: T): T {
  selfCheckedCommands.add(command)
  return command
}

/** `customerId` -> `customer-id`, used to match a camelCase typo to the real flag. */
function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

type FlagSpec = { name: string; def: ArgDef }

type ArgsShape = {
  /** Declared names, plus the camelCase spellings citty also parsed, plus long aliases. */
  longFlags: Map<string, FlagSpec>
  shortFlags: Map<string, FlagSpec>
  positionals: string[]
  visibleFlags: string[]
}

/** citty's camelCase spelling of a kebab-case flag (`api-key` -> `apiKey`). */
function camelCase(name: string): string {
  return name.replace(/-([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase())
}

function describeArgs(args: ArgsDef): ArgsShape {
  const longFlags = new Map<string, FlagSpec>()
  const shortFlags = new Map<string, FlagSpec>()
  const positionals: string[] = []
  const visibleFlags: string[] = []

  for (const [name, def] of Object.entries(args)) {
    if (def.type === "positional") {
      positionals.push(positionalLabels.get(def) ?? name)
      continue
    }

    // citty also parsed camelCase spellings (`--apiKey`). They stay accepted but unadvertised,
    // and are rewritten to the declared name, because citty dropped their value whenever the
    // flag had a default.
    const spec = { name, def }
    for (const spelling of [camelCase(name), kebabCase(name), name]) longFlags.set(spelling, spec)
    if ("alias" in def) {
      for (const alias of toArray(def.alias)) {
        if (alias.length === 1) shortFlags.set(alias, spec)
        else longFlags.set(alias, spec)
      }
    }
    if (!hiddenArgDefs.has(def)) visibleFlags.push(`--${name}`)
  }

  return { longFlags, shortFlags, positionals, visibleFlags }
}

function takesValue(def: ArgDef): boolean {
  return def.type === "string" || def.type === "enum"
}

export type ArgIssue = {
  argument: string
  reason: "unknown_flag" | "unexpected_argument" | "missing_value"
  suggestion?: string
  note?: string
}

export type ArgProblem =
  | {
      kind: "args"
      command: string
      issues: ArgIssue[]
      validFlags: string[]
      positionals: string[]
    }
  | {
      kind: "command"
      command: string
      argument: string
      suggestion?: string
      commands: string[]
    }

const credentialLikeValue = /^(ok_|sk_|rk_|pk_|whsec_|xox[abprs]-)/i

/** Never echo something that looks like a credential back into logs or agent transcripts. */
function displayValue(value: string): string {
  return credentialLikeValue.test(value) ? "<redacted>" : value
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0] ?? 0
    previous[0] = i
    for (let j = 1; j <= right.length; j++) {
      const above = previous[j] ?? 0
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      previous[j] = Math.min(above + 1, (previous[j - 1] ?? 0) + 1, diagonal + cost)
      diagonal = above
    }
  }
  return previous[right.length] ?? 0
}

/** Picks the closest candidate by typo distance, then by shared hyphen-separated words. */
function closest(input: string, candidates: readonly string[]): string | undefined {
  const normalized = kebabCase(input.replace(/_/g, "-"))
  const exact = candidates.find((candidate) => candidate === normalized)
  if (exact) return exact

  const threshold = normalized.length <= 4 ? 1 : 2
  let best: { candidate: string; distance: number } | undefined
  for (const candidate of candidates) {
    const distance = levenshtein(normalized, candidate)
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { candidate, distance }
    }
  }
  if (best) return best.candidate

  // `content-cursor` -> `cursor`, `customer-domain` -> `customer`
  return candidates
    .filter(
      (candidate) =>
        normalized.endsWith(`-${candidate}`) ||
        normalized.startsWith(`${candidate}-`) ||
        candidate.endsWith(`-${normalized}`) ||
        candidate.startsWith(`${normalized}-`),
    )
    .sort((left, right) => right.length - left.length)[0]
}

type Checked = { problem: ArgProblem | null; tokens: string[] }

/** Checks one command's tokens and returns them with every flag in its declared spelling. */
function checkTokens(tokens: readonly string[], args: ArgsDef, command: string): Checked {
  const shape = describeArgs(args)
  const issues: ArgIssue[] = []
  const out: string[] = []
  const positionals: Array<{ value: string; afterSwitch?: string }> = []
  const visibleNames = shape.visibleFlags.map((flag) => flag.slice(2))

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as string
    const next = tokens[index + 1]

    if (token === "--") {
      for (const value of tokens.slice(index + 1)) positionals.push({ value })
      out.push(...tokens.slice(index))
      break
    }

    if (token.startsWith("--")) {
      const equalsIndex = token.indexOf("=")
      const name = equalsIndex === -1 ? token.slice(2) : token.slice(2, equalsIndex)
      const inline = equalsIndex === -1 ? undefined : token.slice(equalsIndex)
      const spec = shape.longFlags.get(name)

      if (spec) {
        out.push(`--${spec.name}${inline ?? ""}`)
        if (inline !== undefined) continue
        if (takesValue(spec.def)) {
          // citty would take a following flag as this flag's value. A value that really starts
          // with "-" has to be attached: --search=-draft.
          if (next === undefined || next.startsWith("-")) {
            issues.push({ argument: `--${name}`, reason: "missing_value" })
          } else {
            out.push(next)
            index++
          }
        } else if (next !== undefined && !next.startsWith("-")) {
          positionals.push({ value: next, afterSwitch: `--${spec.name}` })
          out.push(next)
          index++
        }
        continue
      }

      const negated = name.startsWith("no-") ? shape.longFlags.get(name.slice(3)) : undefined
      if (negated && negated.def.type === "boolean" && inline === undefined) {
        out.push(`--no-${negated.name}`)
        continue
      }

      const suggestion = closest(name, visibleNames)
      issues.push({
        argument: `--${name}`,
        reason: "unknown_flag",
        ...(suggestion ? { suggestion: `--${suggestion}` } : {}),
      })
      // An unknown flag's value would otherwise be reported again as a stray argument.
      if (inline === undefined && next !== undefined && !next.startsWith("-")) index++
      continue
    }

    if (token.startsWith("-") && token !== "-") {
      const spec = token.length === 2 ? shape.shortFlags.get(token.slice(1)) : undefined
      if (spec) {
        out.push(token)
        if (takesValue(spec.def)) {
          if (next === undefined || next.startsWith("-")) {
            issues.push({ argument: token, reason: "missing_value" })
          } else {
            out.push(next)
            index++
          }
        }
        continue
      }
      const suggestion = closest(token.replace(/^-+/, ""), visibleNames)
      issues.push({
        argument: token,
        reason: "unknown_flag",
        ...(suggestion ? { suggestion: `--${suggestion}` } : {}),
      })
      continue
    }

    positionals.push({ value: token })
    out.push(token)
  }

  for (const extra of positionals.slice(shape.positionals.length)) {
    const issue: ArgIssue = {
      argument: displayValue(extra.value),
      reason: "unexpected_argument",
    }
    if (extra.afterSwitch) {
      issue.note = `${extra.afterSwitch} is a switch and takes no value`
    } else if (shape.positionals.length === 0 && visibleNames.includes("customer")) {
      issue.suggestion = `--customer ${displayValue(extra.value)}`
    }
    issues.push(issue)
  }

  if (issues.length === 0) return { problem: null, tokens: out }

  return {
    problem: {
      kind: "args",
      command,
      issues,
      validFlags: shape.visibleFlags,
      positionals: shape.positionals,
    },
    tokens: out,
  }
}

/**
 * Checks raw CLI input against the command tree the way citty will route it, before anything
 * runs, and returns the input to hand to citty. citty itself ignores unknown flags and surplus
 * positionals, which silently widens a query (for example to the whole workspace) instead of
 * failing. Flags typed before a subcommand, which citty would drop, move to the subcommand when
 * it takes them.
 */
export async function analyzeArgs(
  root: AnyCommand,
  rawArgs: readonly string[],
): Promise<{ problem: ArgProblem | null; rawArgs: string[] }> {
  const unchanged = { problem: null, rawArgs: [...rawArgs] }
  if (rawArgs.length === 0) return unchanged
  // citty answers these itself before parsing anything else.
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return unchanged
  if (rawArgs.length === 1 && rawArgs[0] === "--version") return unchanged

  const rootMeta = await resolveValue(root.meta ?? {})
  const path = [rootMeta.name ?? "outlit"]
  // Tokens kept before each chosen subcommand, and the flags typed there.
  const kept: string[][] = []
  const carried: Array<{ token: string; level: number; group: string[] | null }> = []
  let command = root
  let tokens = rawArgs

  const assemble = (tail: readonly string[]) => [
    ...kept.flatMap((segment, level) => [...segment, path[level + 1] as string]),
    ...tail,
  ]

  while (true) {
    if (selfCheckedCommands.has(command)) {
      return { problem: null, rawArgs: assemble([...carried.map((c) => c.token), ...tokens]) }
    }

    const args = await resolveArgs(command)
    const subCommands = await resolveValue(command.subCommands ?? {})
    const hasSubCommands = Object.keys(subCommands).length > 0
    // citty routes to the first token that does not start with "-".
    const subCommandIndex = hasSubCommands
      ? tokens.findIndex((token) => !token.startsWith("-"))
      : -1

    if (subCommandIndex === -1) {
      // citty shows usage when a group runs without a subcommand.
      if (hasSubCommands && !command.run) return unchanged

      const label = path.join(" ")
      const forwarded: string[] = []
      // Judged on their own, so a carried flag never takes a value from the subcommand's input.
      const carriedIssues: ArgIssue[] = []
      for (const item of carried) {
        const own = checkTokens([item.token], args, label)
        if (!own.problem) forwarded.push(...own.tokens)
        else if (item.group) kept[item.level]?.push(...item.group)
        else if (own.problem.kind === "args") carriedIssues.push(...own.problem.issues)
      }
      const checked = checkTokens(tokens, args, label)
      const issues = [
        ...carriedIssues,
        ...(checked.problem?.kind === "args" ? checked.problem.issues : []),
      ]
      if (issues.length === 0) {
        // Forwarded flags are complete on their own; they only have to stay before a `--`.
        const end = checked.tokens.indexOf("--")
        const at = end === -1 ? checked.tokens.length : end
        return {
          problem: null,
          rawArgs: assemble([
            ...checked.tokens.slice(0, at),
            ...forwarded,
            ...checked.tokens.slice(at),
          ]),
        }
      }

      const shape = describeArgs(args)
      return {
        problem: {
          kind: "args",
          command: label,
          issues,
          validFlags: shape.visibleFlags,
          positionals: shape.positionals,
        },
        rawArgs: [...rawArgs],
      }
    }

    const level = kept.length
    kept.push([])
    for (const token of tokens.slice(0, subCommandIndex)) {
      const own = checkTokens([token], args, path.join(" "))
      carried.push({ token, level, group: own.problem ? null : own.tokens })
    }

    const name = tokens[subCommandIndex] as string
    const next = subCommands[name]
    if (!next) {
      const visible: string[] = []
      for (const [candidate, definition] of Object.entries(subCommands)) {
        const meta = await resolveValue((await resolveValue(definition))?.meta ?? {})
        if (!meta.hidden) visible.push(candidate)
      }
      const suggestion = closest(name, visible)
      return {
        problem: {
          kind: "command",
          command: path.join(" "),
          argument: displayValue(name),
          commands: visible,
          ...(suggestion ? { suggestion } : {}),
        },
        rawArgs: [...rawArgs],
      }
    }

    command = await resolveValue(next)
    path.push(name)
    tokens = tokens.slice(subCommandIndex + 1)
  }
}

export async function findArgProblem(
  root: AnyCommand,
  rawArgs: readonly string[],
): Promise<ArgProblem | null> {
  return (await analyzeArgs(root, rawArgs)).problem
}

function describeIssue(issue: ArgIssue): string {
  const label =
    issue.reason === "unknown_flag"
      ? `unknown flag ${issue.argument}`
      : issue.reason === "missing_value"
        ? `${issue.argument} needs a value`
        : `unexpected argument "${issue.argument}"`
  if (issue.suggestion) return `${label} (did you mean ${issue.suggestion}?)`
  if (issue.note) return `${label} (${issue.note})`
  return label
}

const issueCodes: Record<ArgIssue["reason"], string> = {
  unknown_flag: "unknown_flag",
  unexpected_argument: "unexpected_argument",
  missing_value: "missing_input",
}

export function formatArgProblem(problem: ArgProblem): {
  lines: string[]
  code: string
  details: Record<string, unknown>
} {
  if (problem.kind === "command") {
    const head = `Unknown command "${problem.argument}" for \`${problem.command}\`${
      problem.suggestion ? ` (did you mean ${problem.suggestion}?)` : ""
    }.`
    return {
      lines: [
        head,
        `Commands: ${problem.commands.join(", ")}.`,
        `Run \`${problem.command} --help\` for usage.`,
      ],
      code: "unknown_command",
      details: {
        command: problem.command,
        invalid: [
          {
            argument: problem.argument,
            reason: "unknown_command",
            ...(problem.suggestion ? { suggestion: problem.suggestion } : {}),
          },
        ],
        validCommands: problem.commands,
      },
    }
  }

  const first = problem.issues[0] as ArgIssue
  const flags = `Valid flags: ${problem.validFlags.length > 0 ? problem.validFlags.join(", ") : "(none)"}.`
  const shape =
    problem.positionals.length === 0
      ? "Takes no positional arguments."
      : `Positional arguments: ${problem.positionals.map((name) => `<${name}>`).join(" ")}.`
  return {
    lines: [
      `\`${problem.command}\`: ${problem.issues.map(describeIssue).join("; ")}.`,
      `${flags} ${shape}`,
      `Run \`${problem.command} --help\` for usage.`,
    ],
    code: issueCodes[first.reason],
    details: {
      command: problem.command,
      invalid: problem.issues,
      validFlags: problem.validFlags,
    },
  }
}

/**
 * Returns the input to run, with flags in their declared spelling and placement, or fails fast
 * in the CLI's usual error shape when input would otherwise be ignored.
 */
export async function prepareArgsOrExit(
  root: AnyCommand,
  rawArgs: readonly string[],
): Promise<string[]> {
  const analyzed = await analyzeArgs(root, rawArgs)
  if (!analyzed.problem) return analyzed.rawArgs

  const json = rawArgs.includes("--json")
  const formatted = formatArgProblem(analyzed.problem)
  return outputError(
    {
      message: formatted.lines.join(isJsonMode(json) ? " " : "\n"),
      code: formatted.code,
      details: formatted.details,
    },
    json,
  )
}

/** citty's usage output without compatibility flags, and with positional labels applied. */
export async function showUsage(command: AnyCommand, parent?: AnyCommand): Promise<void> {
  try {
    const args = await resolveArgs(command)
    const displayArgs: ArgsDef = {}
    for (const [name, def] of Object.entries(args)) {
      if (hiddenArgDefs.has(def)) continue
      // An upper-case key keeps a labelled positional apart from a same-named flag.
      const label = positionalLabels.get(def)
      displayArgs[label ? label.toUpperCase() : name] = def
    }
    console.log(`${await renderUsage({ ...command, args: displayArgs }, parent)}\n`)
  } catch (error) {
    console.error(error)
  }
}

/** Flags a command advertises (help, completions); compatibility spellings are left out. */
export async function visibleFlagNames(command: AnyCommand): Promise<string[]> {
  return describeArgs(await resolveArgs(command)).visibleFlags
}
