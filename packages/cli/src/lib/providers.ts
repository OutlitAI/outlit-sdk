export interface ProviderInfo {
  /** Internal Nango provider ID sent to the platform API. */
  id: string
  /** Human-readable display name. */
  name: string
  /** Integration category. */
  category: "crm" | "communication" | "calls" | "calendar" | "analytics" | "billing"
}

/**
 * Maps CLI-friendly provider names to internal platform identifiers.
 *
 * Notable aliases:
 * - "gmail" → internal "google-mail"
 * - "stripe" → internal "brex-api-key" (historical Nango config name)
 *
 * Excludes clerk/supabase (admin-only, not user-manageable via CLI).
 */
export const INTEGRATION_PROVIDERS: Record<string, ProviderInfo> = {
  salesforce: { id: "salesforce", name: "Salesforce", category: "crm" },
  hubspot: { id: "hubspot", name: "HubSpot", category: "crm" },
  attio: { id: "attio", name: "Attio", category: "crm" },
  slack: { id: "slack", name: "Slack", category: "communication" },
  gmail: { id: "google-mail", name: "Gmail", category: "communication" },
  gong: { id: "gong", name: "Gong", category: "calls" },
  fireflies: { id: "fireflies", name: "Fireflies", category: "calls" },
  "google-calendar": { id: "google-calendar", name: "Google Calendar", category: "calendar" },
  posthog: { id: "posthog", name: "PostHog", category: "analytics" },
  stripe: { id: "brex-api-key", name: "Stripe", category: "billing" },
}

/** All valid CLI provider names, sorted alphabetically. Used for completions and help text. */
export const PROVIDER_NAMES = Object.keys(INTEGRATION_PROVIDERS).sort()

/**
 * Resolves a user-provided provider name to its info, with suggestion on typos.
 *
 * Returns { provider, cliName } on exact match, or { error, suggestion? } on failure.
 */
export function resolveProvider(
  input: string,
): { provider: ProviderInfo; cliName: string } | { error: string; suggestion?: string } {
  const normalized = input.toLowerCase().trim()
  const provider = INTEGRATION_PROVIDERS[normalized]
  if (provider) return { provider, cliName: normalized }

  const suggestion = findClosestMatch(normalized)
  const base = `Unknown integration: "${input}". Available: ${PROVIDER_NAMES.join(", ")}`
  if (suggestion) {
    return { error: `${base}\n\n  Did you mean "${suggestion}"?`, suggestion }
  }
  return { error: base }
}

/** Finds a provider name that starts with the input or vice versa. */
function findClosestMatch(input: string): string | null {
  return PROVIDER_NAMES.find((name) => name.startsWith(input) || input.startsWith(name)) ?? null
}
