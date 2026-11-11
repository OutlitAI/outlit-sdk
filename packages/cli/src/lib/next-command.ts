/**
 * Turns a gateway `next` call ({ tool, input }) into the `outlit ...` command that makes it, for the
 * commands whose input maps one-to-one onto flags. Returns undefined for any other tool or input
 * shape, and the caller falls back to the call's own instruction.
 */

type CommandShape = {
  words: readonly string[]
  /** Input keys that are positional arguments, in order. */
  positional?: readonly string[]
}

const commands: Record<string, CommandShape> = {
  outlit_get_customer: { words: ["customers", "get"], positional: ["customer"] },
  outlit_list_people: { words: ["people", "list"] },
  outlit_get_timeline: { words: ["timeline", "get"], positional: ["customer"] },
  outlit_list_facts: { words: ["facts", "list"], positional: ["customer"] },
  outlit_get_fact: { words: ["facts", "get"], positional: ["id"] },
}

const scalarFlags = new Set(["customer", "limit", "cursor", "timeframe"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Quotes a value for a shell only when it has characters a shell would act on. */
function shellWord(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`
}

function flagsFor(key: string, value: unknown): string[] | undefined {
  if (scalarFlags.has(key) && (typeof value === "string" || typeof value === "number")) {
    return [`--${key}`, shellWord(String(value))]
  }
  if (key === "include" && Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return ["--include", shellWord(value.join(","))]
  }
  if (key === "part" && isRecord(value) && typeof value.field === "string") {
    return [
      "--part",
      shellWord(value.field),
      ...(typeof value.cursor === "string" ? ["--cursor", shellWord(value.cursor)] : []),
    ]
  }
  if (
    key === "crmContacts" &&
    isRecord(value) &&
    typeof value.connectionId === "string" &&
    typeof value.accountId === "string"
  ) {
    return [
      "--crm-contacts",
      shellWord(`${value.connectionId}:${value.accountId}`),
      ...(typeof value.cursor === "string" ? ["--cursor", shellWord(value.cursor)] : []),
    ]
  }
  return undefined
}

export function nextCommand(tool: unknown, input: unknown): string | undefined {
  if (typeof tool !== "string") return undefined
  const shape = commands[tool]
  if (!shape) return undefined
  const params = isRecord(input) ? input : {}

  const positional: string[] = []
  for (const key of shape.positional ?? []) {
    const value = params[key]
    if (typeof value !== "string") return undefined
    positional.push(shellWord(value))
  }

  const flags: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (shape.positional?.includes(key)) continue
    const rendered = flagsFor(key, value)
    if (!rendered) return undefined
    flags.push(...rendered)
  }
  return ["outlit", ...shape.words, ...positional, ...flags].join(" ")
}

/**
 * One line per part of a result that holds only its first part: the section name, how many more
 * there are, and the command that reads them (or, with no command for it, the gateway's own sentence).
 * Walks the result for `more: { omitted, next }`, which sections and a fact's evidence carry.
 */
export function moreLines(data: unknown): string[] {
  const lines: string[] = []
  const visit = (value: unknown, label: string, depth: number) => {
    if (depth > 4) return
    if (Array.isArray(value)) {
      for (const item of value) visit(item, label, depth + 1)
      return
    }
    if (!isRecord(value)) return
    const more = value.more
    if (isRecord(more) && isRecord(more.next)) {
      const { omitted, next } = more
      const count = typeof omitted === "number" ? `${omitted} more` : "More"
      const command = nextCommand(next.tool, next.input)
      const instruction = typeof next.instruction === "string" ? next.instruction : undefined
      const rest = command ?? instruction
      if (rest) lines.push(`${label}: ${count}: ${rest}`)
    }
    // A CRM account with more contacts than listed says so beside them, not as a section.
    const contactsNext = value.contactsNext
    if (isRecord(contactsNext)) {
      const count =
        typeof value.omittedContactCount === "number" ? `${value.omittedContactCount} more` : "More"
      const rest =
        nextCommand(contactsNext.tool, contactsNext.input) ??
        (typeof contactsNext.instruction === "string" ? contactsNext.instruction : undefined)
      if (rest) lines.push(`${label}: ${count} contacts: ${rest}`)
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "more") continue
      visit(child, depth === 0 ? key : label, depth + 1)
    }
  }
  visit(data, "result", 0)
  return lines
}
