import {
  normalizeCustomerSourceToolInput,
  normalizeCustomerSourceType,
  type ToolSourceType,
  toToolSourceType,
} from "@outlit/tools"

/**
 * Maps source types a person typed to the lowercase v2 wire spelling. Any case is accepted, and so
 * are the previously published aliases (`CRM`, `CRM_OPPORTUNITY`, and for the source tools
 * `STRIPE_INVOICE`); help advertises only the lowercase names.
 */
export function toWireSourceTypes(
  values: string[],
  options: { sourceTools: boolean },
): { ok: true; types: ToolSourceType[] } | { ok: false; invalid: string[] } {
  const normalize = options.sourceTools
    ? normalizeCustomerSourceToolInput
    : normalizeCustomerSourceType
  const invalid: string[] = []
  const types = new Set<ToolSourceType>()
  for (const value of values) {
    const canonical = normalize(value)
    if (canonical) types.add(toToolSourceType(canonical))
    else invalid.push(value)
  }
  if (invalid.length > 0) return { ok: false, invalid }
  return { ok: true, types: [...types] }
}
