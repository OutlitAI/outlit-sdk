/**
 * Reads the last value given for an undeclared `--flag value` or `--flag=value` option. Returns
 * undefined when the flag is absent and "" when it is present without a value (a following token
 * that starts with `--` is the next flag, not a value). Used for previously published spellings
 * that stay accepted but are no longer declared, so help and completions advertise only the new one.
 */
export function rawFlagValue(rawArgs: string[] | undefined, flag: string): string | undefined {
  let value: string | undefined
  for (const [index, arg] of (rawArgs ?? []).entries()) {
    if (arg === `--${flag}`) {
      const next = rawArgs?.[index + 1]
      value = next === undefined || next.startsWith("--") ? "" : next
    } else if (arg.startsWith(`--${flag}=`)) value = arg.slice(flag.length + 3)
  }
  return value
}
