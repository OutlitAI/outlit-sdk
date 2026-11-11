import { getPublicToolContract } from "@outlit/tools"
import { splitCsv } from "../lib/config"
import { outputError } from "../lib/output"

/** What `facts list` and `search` can add to each fact, as the tool's `include` accepts them. */
export const factListIncludes: readonly string[] =
  getPublicToolContract("outlit_list_facts").inputSchema.properties.include.items.enum

/** The long fields of a fact `facts get --part` reads a page at a time. */
export const factParts: readonly string[] =
  getPublicToolContract("outlit_get_fact").inputSchema.properties.part.properties.field.enum

export const factIncludeArg = {
  include: {
    type: "string",
    description: `Comma-separated extras on each fact (${factListIncludes.join(", ")}). Without it a fact has no reasoning or quote`,
  },
} as const

/**
 * The `include` list from `--include reasoning,quote`, or undefined when the flag is absent. The tool
 * is strict about the values, so an unknown one is refused here with the allowed ones.
 */
export function readFactIncludes(value: string | undefined, json: boolean): string[] | undefined {
  if (!value) return undefined
  const items = splitCsv(value)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  if (items.length === 0) return undefined
  const unknown = items.filter((item) => !factListIncludes.includes(item))
  if (unknown.length > 0) {
    return outputError(
      {
        message: `Unknown include values: ${unknown.join(", ")}. Allowed: ${factListIncludes.join(", ")}`,
        code: "invalid_input",
      },
      json,
    )
  }
  return [...new Set(items)]
}
