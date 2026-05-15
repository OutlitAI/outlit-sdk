import { outputError } from "./output"

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

export type ProviderAuthType = "api_key" | "oauth"
export type ProviderSetupMode = "direct_api_key" | "nango_connect" | "manual"
export type ProviderCredentialType = "api_key" | "api_token" | "oauth"

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
  /** High-level auth category retained for older Core capability responses. */
  authType: ProviderAuthType
  /** Which setup flow the CLI should use for this provider. */
  setupMode?: ProviderSetupMode
  /** The credential shape used by direct setup flows. */
  credentialType?: ProviderCredentialType
  /** Required config fields for api_key providers. */
  configFields?: ConfigField[]
  /** Whether the CLI can currently initiate connection setup for this provider. */
  connectSupported?: boolean
  /** Notes exposed to agents through `integrations capabilities`. */
  notes?: string[]
  /** Follow-up work after authentication succeeds. */
  postConnectSteps?: ProviderPostConnectStep[]
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
  providerId: string
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

const WEBHOOK_SETUP_BY_PROVIDER: Record<string, Omit<ProviderPostConnectStep, "id">> = {
  fireflies: {
    label: "Configure Fireflies realtime webhooks",
    required: true,
    supported: true,
    command: "outlit integrations setup fireflies webhooks",
    note: "Returns the Fireflies webhook URL and signing secret for manual provider setup.",
  },
  posthog: {
    label: "Configure PostHog Data Pipeline webhooks",
    required: true,
    supported: true,
    command: "outlit integrations setup posthog webhooks",
    note: "Returns the PostHog webhook URL and x-outlit-auth header for manual Data Pipeline setup.",
  },
  pylon: {
    label: "Configure Pylon realtime webhooks",
    required: true,
    supported: true,
    command: "outlit integrations setup pylon webhooks",
    note: "Returns the Pylon webhook URL and shared secret header for manual trigger setup.",
  },
  stripe: {
    label: "Configure Stripe realtime webhooks",
    required: true,
    supported: true,
    command: "outlit integrations setup stripe webhooks",
    note: "Returns the Stripe webhook URL and required events; pass webhookSecret to store the signing secret.",
  },
}

/**
 * Maps CLI-friendly provider names to internal platform identifiers.
 *
 * Notable aliases:
 * - "gmail" → internal "google-mail"
 * - "stripe" → internal "brex-api-key" (historical Nango config name)
 */
export const INTEGRATION_PROVIDERS: Record<string, ProviderInfo> = {
  // Browser/Nango providers
  salesforce: { id: "salesforce", name: "Salesforce", category: "crm", authType: "oauth" },
  hubspot: { id: "hubspot", name: "HubSpot", category: "crm", authType: "oauth" },
  attio: { id: "attio", name: "Attio", category: "crm", authType: "oauth" },
  slack: { id: "slack", name: "Slack", category: "communication", authType: "oauth" },
  gmail: { id: "google-mail", name: "Gmail", category: "communication", authType: "oauth" },
  "google-mail": {
    id: "google-mail",
    name: "Gmail",
    category: "communication",
    authType: "oauth",
  },
  "google-calendar": {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    authType: "oauth",
  },
  granola: {
    id: "granola",
    name: "Granola",
    category: "calls",
    authType: "api_key",
    configFields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
  // Direct credential providers
  pylon: {
    id: "pylon",
    name: "Pylon",
    category: "support",
    authType: "api_key",
    setupMode: "direct_api_key",
    credentialType: "api_token",
    configFields: [{ key: "apiToken", label: "API Token", secret: true }],
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

export function getProviderCapabilities(): ProviderCapability[] {
  return PROVIDER_NAMES.map((cliName) =>
    buildProviderCapability(cliName, INTEGRATION_PROVIDERS[cliName]!),
  )
}

export function getProviderCapability(input: string): ProviderCapability | null {
  const result = resolveProvider(input)
  if ("error" in result) return null
  return buildProviderCapability(result.cliName, result.provider)
}

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

function buildProviderCapability(cliName: string, provider: ProviderInfo): ProviderCapability {
  const connectSupported = provider.connectSupported !== false
  const postConnectSteps =
    provider.postConnectSteps ?? buildDefaultPostConnectSteps(cliName, provider)
  const setupMode = provider.setupMode ?? defaultSetupMode(provider.authType)
  const credentialType = provider.credentialType ?? defaultCredentialType(provider.authType)

  return {
    cliName,
    providerId: provider.id,
    displayName: provider.name,
    category: provider.category,
    authType: provider.authType,
    setupMode,
    credentialType,
    connectSupported,
    requiredFields: provider.configFields ?? [],
    commands: buildCapabilityCommands(cliName, setupMode, connectSupported),
    postConnectSteps,
    notes: provider.notes ?? [],
  }
}

function buildCapabilityCommands(
  cliName: string,
  setupMode: ProviderSetupMode,
  connectSupported: boolean,
): string[] {
  const commands = [`outlit integrations capabilities ${cliName}`]
  if (connectSupported) commands.push(`outlit integrations setup ${cliName}`)
  if (setupMode === "nango_connect" && connectSupported) {
    commands.push("outlit integrations status --session <sessionId>")
  }
  commands.push(`outlit integrations status ${cliName}`)
  return commands
}

function defaultSetupMode(authType: ProviderAuthType): ProviderSetupMode {
  return authType === "api_key" ? "direct_api_key" : "nango_connect"
}

function defaultCredentialType(authType: ProviderAuthType): ProviderCredentialType {
  return authType === "api_key" ? "api_key" : "oauth"
}

function buildDefaultPostConnectSteps(
  cliName: string,
  provider: ProviderInfo,
): ProviderPostConnectStep[] {
  const steps: ProviderPostConnectStep[] = []

  if (provider.category === "crm") {
    steps.push({
      id: "crm-mapping",
      label: "Configure CRM pipeline and stage mappings",
      required: true,
      supported: true,
      command: `outlit integrations setup ${cliName} mappings`,
      note: "Fetches CRM pipelines, saves stage mappings, and starts CRM syncs after mappings are provided.",
    })
  }

  const webhookStep = WEBHOOK_SETUP_BY_PROVIDER[cliName]
  if (webhookStep) {
    steps.push({
      id: "webhook-setup",
      ...webhookStep,
    })
  }

  return steps
}
