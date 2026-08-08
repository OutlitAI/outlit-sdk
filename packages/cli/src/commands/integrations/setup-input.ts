import * as p from "@clack/prompts"
import { matchesGeneratedJsonSchema, publicToolContracts } from "@outlit/tools"

export type SetupToolInput = Record<string, unknown> & { provider: string }

export class SetupInputError extends Error {
  readonly code: string

  constructor(message: string, code = "invalid_input") {
    super(message)
    this.name = "SetupInputError"
    this.code = code
  }
}

export class SetupCancelledError extends Error {
  constructor() {
    super("Integration setup was cancelled.")
    this.name = "SetupCancelledError"
  }
}

export async function readSetupConfigText(): Promise<string> {
  return Bun.stdin.text()
}

export function parseSetupConfig(text: string, provider: string): SetupToolInput {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new SetupInputError("--config-stdin requires exactly one valid JSON document.")
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SetupInputError("--config-stdin must contain a JSON object.")
  }

  const config = parsed as Record<string, unknown>
  const allowedKeys = new Set(["connectionMode", "credentials", "configuration"])
  if (Object.keys(config).some((key) => !allowedKeys.has(key))) {
    throw new SetupInputError(
      "--config-stdin accepts only connectionMode, credentials, and configuration.",
    )
  }

  const input: SetupToolInput = { provider, ...config }
  const schema = publicToolContracts.outlit_setup_integration.inputSchema
  if (!matchesGeneratedJsonSchema(input, schema)) {
    throw new SetupInputError("--config-stdin does not match this provider's setup contract.")
  }

  return input
}

export function hasCrmConfiguration(input: SetupToolInput): boolean {
  const configuration = input.configuration
  return (
    typeof configuration === "object" &&
    configuration !== null &&
    !Array.isArray(configuration) &&
    (configuration as Record<string, unknown>).kind === "crm_mapping"
  )
}

export async function collectProviderCredentials(provider: string): Promise<SetupToolInput> {
  switch (provider) {
    case "stripe":
      return {
        provider,
        connectionMode: "restricted_key",
        credentials: { apiKey: await secret("Stripe restricted API key") },
      }
    case "granola": {
      const authScope = await choice<"personal" | "enterprise">("Granola key scope", [
        { value: "personal", label: "Personal" },
        { value: "enterprise", label: "Enterprise" },
      ])
      const enterpriseKeyAcknowledged =
        authScope === "enterprise"
          ? await confirmation("I confirm this is an enterprise Granola key")
          : false
      if (authScope === "enterprise" && !enterpriseKeyAcknowledged) {
        throw new SetupCancelledError()
      }
      return {
        provider,
        credentials: {
          apiKey: await secret("Granola API key"),
          authScope,
          enterpriseKeyAcknowledged,
        },
      }
    }
    case "fireflies":
      return { provider, credentials: { apiKey: await secret("Fireflies API key") } }
    case "pylon":
      return { provider, credentials: { apiToken: await secret("Pylon API token") } }
    case "mixpanel":
      return {
        provider,
        credentials: {
          username: await visible("Mixpanel service-account username"),
          secret: await secret("Mixpanel service-account secret"),
          projectId: await visible("Mixpanel project ID"),
          region: await choice<"us" | "eu" | "in">("Mixpanel region", [
            { value: "us", label: "US" },
            { value: "eu", label: "EU" },
            { value: "in", label: "India" },
          ]),
        },
      }
    case "posthog":
      return {
        provider,
        credentials: {
          apiKey: await secret("PostHog personal API key"),
          projectId: await visible("PostHog project ID"),
          region: await choice<"us" | "eu">("PostHog region", [
            { value: "us", label: "US" },
            { value: "eu", label: "EU" },
          ]),
        },
      }
    default:
      throw new SetupInputError(
        "Core requested credentials for a provider without a CLI credential contract.",
        "INVALID_SETUP_RESPONSE",
      )
  }
}

export async function confirmCrmRecommendation(): Promise<boolean> {
  return confirmation("Apply this exact CRM stage mapping?")
}

export async function collectMixpanelMapping(
  candidateKeys: Array<{ key: string }>,
): Promise<Record<string, string>> {
  const mode = await choice<"group_key" | "event_property" | "email_domain">(
    "How should Mixpanel events map to Outlit customers?",
    [
      { value: "group_key", label: "Mixpanel group key" },
      { value: "event_property", label: "Event property" },
      { value: "email_domain", label: "Email domain" },
    ],
  )

  if (mode === "email_domain") return { mode }
  if (mode === "event_property") {
    return { mode, propertyName: await visible("Mixpanel event property") }
  }

  const groupKey =
    candidateKeys.length > 0
      ? await choice(
          "Mixpanel group key",
          candidateKeys.map(({ key }) => ({ value: key, label: key })),
        )
      : await visible("Mixpanel group key")
  return { mode, groupKey }
}

async function secret(message: string): Promise<string> {
  const value = await p.password({
    message,
    validate: (input) => (input?.trim() ? undefined : "A value is required"),
  })
  if (p.isCancel(value)) throw new SetupCancelledError()
  return String(value).trim()
}

async function visible(message: string): Promise<string> {
  const value = await p.text({
    message,
    validate: (input) => (input?.trim() ? undefined : "A value is required"),
  })
  if (p.isCancel(value)) throw new SetupCancelledError()
  return String(value).trim()
}

async function choice<T extends string>(
  message: string,
  options: Array<{ value: T; label: string }>,
): Promise<T> {
  const value = await p.select<string>({ message, options })
  if (p.isCancel(value)) throw new SetupCancelledError()
  return value as T
}

async function confirmation(message: string): Promise<boolean> {
  const value = await p.confirm({ message })
  if (p.isCancel(value)) throw new SetupCancelledError()
  return value
}
