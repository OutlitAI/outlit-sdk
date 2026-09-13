import type { customerIncludeSections } from "@outlit/tools"
import { splitCsv } from "../lib/config"

// Keep CLI vocabulary separate from the existing API response contract.
const sections: Record<string, (typeof customerIncludeSections)[number]> = {
  users: "users",
  revenue: "revenue",
  activity: "recentTimeline",
  metrics: "behaviorMetrics",
  enrichment: "enrichment",
  balances: "featureBalances",
}

export const customerSections = Object.keys(sections)

export function parseCustomerSections(value: string): string[] {
  // Existing API spellings remain accepted for scripts using older CLI versions.
  return [
    ...new Set(
      splitCsv(value).map((section) =>
        Object.hasOwn(sections, section) ? sections[section]! : section,
      ),
    ),
  ]
}
