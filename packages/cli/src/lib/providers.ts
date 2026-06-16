export type ProviderCategory =
  | "communication"
  | "calls"
  | "calendar"
  | "crm"
  | "analytics"
  | "billing"
  | "support"
  | "auth"
  | "data"

export type ProviderAuthType = "api_key" | "basic_auth" | "oauth"
export type ProviderSetupMode = "direct_api_key" | "browser_auth" | "manual"
export type ProviderCredentialType = "api_key" | "api_token" | "basic_auth" | "oauth"

export interface ConfigField {
  key: string
  label: string
  /** When true, input is masked in interactive prompts. */
  secret?: boolean
}

export interface ProviderPostConnectStep {
  id: string
  label: string
  required: boolean
  supported: boolean
  command?: string
  note?: string
}

export interface ProviderCapability {
  cliName: string
  /** Public provider ID returned by Core. The CLI should pass cliName/providerId back unchanged. */
  providerId?: string
  displayName: string
  category: ProviderCategory
  authType: ProviderAuthType
  setupMode: ProviderSetupMode
  credentialType: ProviderCredentialType
  connectSupported: boolean
  requiredFields: ConfigField[]
  commands: string[]
  postConnectSteps: ProviderPostConnectStep[]
  notes: string[]
}

/**
 * Static provider names are only for help text and shell completions.
 * Core owns aliases, internal provider IDs, setup modes, required fields, and follow-up steps.
 */
export const PROVIDER_NAMES = [
  "attio",
  "clerk",
  "fireflies",
  "gmail",
  "gong",
  "google-calendar",
  "google-mail",
  "granola",
  "hubspot",
  "mixpanel",
  "posthog",
  "pylon",
  "salesforce",
  "slack",
  "stripe",
  "supabase",
] as const

export function normalizeProviderInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
}
