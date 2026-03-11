import { outputError } from "./output"

export type ProviderCategory =
  | "communication"
  | "calls"
  | "calendar"
  | "analytics"
  | "billing"
  | "support"
  | "auth"
  | "data"

export type ProviderAuthType = "api_key" | "oauth"

export interface ConfigField {
  key: string
  label: string
  /** When true, input is masked in interactive prompts. */
  secret?: boolean
}

export interface ProviderInfo {
  /** Internal provider ID sent to the platform API (Nango config key for OAuth, app identifier for API-key). */
  id: string
  /** Human-readable display name. */
  name: string
  /** Integration category. */
  category: ProviderCategory
  /** How this provider authenticates — OAuth browser flow or direct API key. */
  authType: ProviderAuthType
  /** Required config fields for api_key providers. */
  configFields?: ConfigField[]
}

/**
 * Maps CLI-friendly provider names to internal platform identifiers.
 *
 * Notable aliases:
 * - "gmail" → internal "google-mail"
 * - "stripe" → internal "brex-api-key" (historical Nango config name)
 */
export const INTEGRATION_PROVIDERS: Record<string, ProviderInfo> = {
  // OAuth providers
  slack: { id: "slack", name: "Slack", category: "communication", authType: "oauth" },
  gmail: { id: "google-mail", name: "Gmail", category: "communication", authType: "oauth" },
  "google-calendar": {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    authType: "oauth",
  },
  // API-key providers
  pylon: {
    id: "pylon",
    name: "Pylon",
    category: "support",
    authType: "api_key",
    configFields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
  stripe: {
    id: "brex-api-key",
    name: "Stripe",
    category: "billing",
    authType: "api_key",
    configFields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
  fireflies: {
    id: "fireflies",
    name: "Fireflies",
    category: "calls",
    authType: "api_key",
    configFields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
  posthog: {
    id: "posthog",
    name: "PostHog",
    category: "analytics",
    authType: "api_key",
    configFields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "region", label: "Region (us or eu)" },
      { key: "projectId", label: "Project ID" },
    ],
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    category: "data",
    authType: "api_key",
    configFields: [
      { key: "projectUrl", label: "Project URL" },
      { key: "serviceRoleKey", label: "Service Role Key", secret: true },
    ],
  },
  clerk: {
    id: "clerk",
    name: "Clerk",
    category: "auth",
    authType: "api_key",
    configFields: [{ key: "secretKey", label: "Secret Key", secret: true }],
  },
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

/**
 * Resolves a provider or exits with unknown_provider error.
 * Eliminates the repeated resolve + error-check boilerplate in commands.
 */
export function resolveProviderOrExit(
  input: string,
  json: boolean,
): { provider: ProviderInfo; cliName: string } {
  const result = resolveProvider(input)
  if ("error" in result) {
    return outputError({ message: result.error, code: "unknown_provider" }, json)
  }
  return result
}

/** Finds a provider name that starts with the input or vice versa. */
function findClosestMatch(input: string): string | null {
  return PROVIDER_NAMES.find((name) => name.startsWith(input) || input.startsWith(name)) ?? null
}
