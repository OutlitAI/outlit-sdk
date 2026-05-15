import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import type { OutlitClient } from "../../lib/client"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"
import type {
  ConfigField,
  ProviderAuthType,
  ProviderCapability,
  ProviderCredentialType,
  ProviderSetupMode,
} from "../../lib/providers"
import { normalizeProviderInput, PROVIDER_NAMES } from "../../lib/providers"
import { createSpinner } from "../../lib/spinner"
import { openBrowser } from "../../lib/tty"
import { waitForIntegrationConnection } from "./wait-for-connection"

interface ConnectResponse {
  sessionId?: string
  connectionId?: string
  alreadyConnected: boolean
  connectUrl?: string
}

interface IntegrationListItem {
  id?: string
  provider?: string
  providerId?: string
  status?: string
  connectionId?: string
  syncStatus?: string | null
  errorMessage?: string | null
}

type SetupCapability = ProviderCapability & {
  cliName: string
  providerId?: string
  displayName?: string
  authType: ProviderAuthType
  setupMode?: ProviderSetupMode
  credentialType?: ProviderCredentialType
  connectSupported: boolean
  requiredFields: ConfigField[]
  postConnectSteps: ProviderCapability["postConnectSteps"]
  notes?: string[]
}

export default defineCommand({
  meta: {
    name: "setup",
    description: [
      "Run the provider-owned setup flow for an integration.",
      "",
      "Browser-auth providers open the browser and wait in interactive mode.",
      "In JSON mode, they return a connect URL and pollable session ID.",
      "Direct credential providers require --config with the provider-specific fields.",
      "Use `capabilities` first when choosing integrations programmatically.",
      "",
      "Examples:",
      "  outlit integrations setup hubspot --json",
      "  outlit integrations setup hubspot mappings --json",
      "  outlit integrations setup pylon webhooks --json",
      "  outlit integrations status --session sess_123 --json",
      '  outlit integrations setup stripe --config \'{"apiKey":"rk_xxx"}\' --json',
      '  outlit integrations setup pylon --config \'{"apiToken":"pylon_xxx"}\' --json',
      "",
      `Providers: ${PROVIDER_NAMES.join(", ")}`,
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    provider: {
      type: "positional",
      description: "Integration provider to set up",
      required: true,
    },
    step: {
      type: "positional",
      description: "Provider follow-up step to inspect or run (for example mappings or webhooks)",
      required: false,
    },
    force: {
      type: "boolean",
      description: "Reconnect even if the integration is already connected.",
    },
    config: {
      type: "string",
      description: 'JSON configuration for API-key integrations (e.g. \'{"apiKey": "sk_xxx"}\')',
    },
  },
  async run({ args }) {
    const json = !!args.json
    const provider = normalizeProviderInput(args.provider)
    const client = await getClientOrExit(args["api-key"], json)
    const capability = await fetchProviderCapability(client, provider, json)

    if (typeof args.step === "string" && args.step.trim()) {
      return setupProviderFollowUp(
        client,
        capability,
        args.step,
        json,
        args.config as string | undefined,
      )
    }

    if (!capability.connectSupported) {
      return outputResult({
        status: "unsupported",
        provider: capability.cliName,
        connectSupported: false,
        notes: capability.notes,
        capabilities: capability,
      })
    }

    const setupMode = capability.setupMode ?? defaultSetupMode(capability.authType)

    if (setupMode === "direct_api_key") {
      return setupApiKeyProvider(
        client,
        capability,
        json,
        args.config as string | undefined,
        !!args.force,
      )
    }

    if (args.config) {
      return outputError(
        {
          message: `${capability.displayName ?? capability.cliName} uses browser authentication and does not accept --config.`,
          code: "invalid_input",
        },
        json,
      )
    }

    return setupOAuthProvider(client, capability, json, !!args.force)
  },
})

async function setupApiKeyProvider(
  client: OutlitClient,
  capability: SetupCapability,
  json: boolean,
  rawConfig: string | undefined,
  force: boolean,
): Promise<void> {
  const fields = capability.requiredFields ?? []
  const displayName = capability.displayName ?? capability.cliName

  if (!rawConfig) {
    if (!force) {
      const existing = await fetchConnectedIntegration(client, capability)
      if (existing) {
        return outputResult({
          status: "already_connected",
          provider: capability.cliName,
          connectionId: existing.connectionId,
          syncStatus: existing.syncStatus,
          errorMessage: existing.errorMessage,
          nextActions: buildConnectedNextActions(capability.cliName, capability),
          capabilities: capability,
        })
      }
    }

    const nextActions = [
      `outlit integrations setup ${capability.cliName} --config '${buildConfigTemplate(fields)}' --json`,
      `outlit integrations capabilities ${capability.cliName} --json`,
    ]

    if (isJsonMode(json)) {
      return outputResult({
        status: "config_required",
        provider: capability.cliName,
        requiredFields: fields,
        nextActions,
        capabilities: capability,
      })
    }

    console.log(`${displayName} requires configuration:`)
    for (const field of fields) console.log(`  - ${field.key}: ${field.label}`)
    console.log(`\nNext: ${nextActions[0]}`)
    return
  }

  const config = parseConfigOrExit(rawConfig, fields, json)
  const spinner = createSpinner(`Connecting ${displayName}...`)
  let connectData: ConnectResponse

  try {
    connectData = (await client.callTool("outlit_connect_integration", {
      provider: capability.cliName,
      config,
      ...(force ? { force: true } : {}),
    })) as ConnectResponse
  } catch (err) {
    spinner.fail(`Failed to connect ${displayName}`)
    return outputError(
      { message: errorMessage(err, "Failed to connect integration"), code: "api_error" },
      json,
    )
  }

  if (connectData.alreadyConnected && !force) {
    spinner.stop(`${displayName} is already connected`)
    return outputResult({
      status: "already_connected",
      provider: capability.cliName,
      connectionId: connectData.connectionId,
      nextActions: buildConnectedNextActions(capability.cliName, capability),
      capabilities: capability,
    })
  }

  spinner.stop(`${displayName} connected successfully!`)
  return outputResult({
    status: "connected",
    provider: capability.cliName,
    connectionId: connectData.connectionId,
    nextActions: buildConnectedNextActions(capability.cliName, capability),
    capabilities: capability,
  })
}

async function setupOAuthProvider(
  client: OutlitClient,
  capability: SetupCapability,
  json: boolean,
  force: boolean,
): Promise<void> {
  const displayName = capability.displayName ?? capability.cliName
  const spinner = createSpinner(`Starting ${displayName} setup...`)
  let connectData: ConnectResponse

  try {
    connectData = (await client.callTool("outlit_connect_integration", {
      provider: capability.cliName,
      ...(force ? { force: true } : {}),
    })) as ConnectResponse
  } catch (err) {
    spinner.fail(`Failed to start ${displayName} setup`)
    return outputError(
      { message: errorMessage(err, "Failed to start setup flow"), code: "api_error" },
      json,
    )
  }

  if (connectData.alreadyConnected && !force) {
    spinner.stop(`${displayName} is already connected`)
    return outputResult({
      status: "already_connected",
      provider: capability.cliName,
      nextActions: buildConnectedNextActions(capability.cliName, capability),
      capabilities: capability,
    })
  }

  const connectUrl = connectData.connectUrl ?? `${client.baseUrl}/integrations`
  if (!isJsonMode(json)) {
    const opened = openBrowser(connectUrl)
    spinner.stop(opened ? `Browser opened for ${displayName}` : "Could not open browser")
    if (!opened) console.log(`Open this URL to continue: ${connectUrl}`)

    if (connectData.sessionId) {
      await waitForIntegrationConnection({
        client,
        sessionId: connectData.sessionId,
        displayName,
        cliName: capability.cliName,
        retryCommand: `outlit integrations setup ${capability.cliName}`,
      })
      return
    }
  } else {
    spinner.stop(`Started ${displayName} setup`)
  }

  const nextActions = [
    ...(connectData.sessionId
      ? [`outlit integrations status --session ${connectData.sessionId} --json`]
      : []),
    `outlit integrations status ${capability.cliName} --json`,
  ]

  return outputResult({
    status: "awaiting_auth",
    provider: capability.cliName,
    connectUrl,
    sessionId: connectData.sessionId,
    nextActions,
    capabilities: capability,
  })
}

async function setupProviderFollowUp(
  client: OutlitClient,
  capability: SetupCapability,
  inputStep: string,
  json: boolean,
  rawConfig?: string,
): Promise<void> {
  const step = resolvePostConnectStep(capability, inputStep)
  const displayName = capability.displayName ?? capability.cliName

  if (!step) {
    const available = capability.postConnectSteps
      .map((candidate) => candidate.command?.split(" ").at(-1) ?? candidate.id)
      .join(", ")

    outputError(
      {
        message: available
          ? `Unknown ${displayName} setup step: "${inputStep}". Available steps: ${available}`
          : `${displayName} does not expose provider follow-up setup steps.`,
        code: "unknown_setup_step",
      },
      json,
    )
  }

  const stepLabel = step.label ?? step.id
  if (!step.supported) {
    outputResult({
      status: "unsupported_follow_up",
      provider: capability.cliName,
      step: step.id,
      message:
        step.note ??
        `${stepLabel} is required but is not automated by this CLI release. Use Outlit platform settings for this step.`,
      nextActions: [`outlit integrations capabilities ${capability.cliName} --json`],
      capabilities: capability,
    })
    return
  }

  const config = rawConfig ? parseFollowUpConfigOrExit(rawConfig, json) : undefined
  const spinner = createSpinner(`Running ${displayName} ${stepLabel} setup...`)

  try {
    const result = (await client.callTool("outlit_integration_setup_step", {
      provider: capability.cliName,
      step: step.id,
      ...(config ? { config } : {}),
    })) as Record<string, unknown>

    spinner.stop(`${displayName} ${stepLabel} setup checked`)
    return outputResult({
      ...result,
      capabilities: capability,
    })
  } catch (err) {
    spinner.fail(`Failed to run ${displayName} ${stepLabel} setup`)
    return outputError(
      { message: errorMessage(err, "Failed to run integration setup step"), code: "api_error" },
      json,
    )
  }
}

function resolvePostConnectStep(
  capability: SetupCapability,
  inputStep: string,
): SetupCapability["postConnectSteps"][number] | undefined {
  const normalized = normalizeSetupStep(inputStep)

  return capability.postConnectSteps.find((step) => {
    const id = normalizeSetupStep(step.id)
    const commandStep = step.command?.split(" ").at(-1)
    const commandToken = commandStep ? normalizeSetupStep(commandStep) : null

    return (
      normalized === id ||
      normalized === commandToken ||
      (normalized === "webhooks" && id.includes("webhook")) ||
      (normalized === "webhook" && id.includes("webhook")) ||
      (normalized === "mappings" && id.includes("mapping")) ||
      (normalized === "mapping" && id.includes("mapping"))
    )
  })
}

function normalizeSetupStep(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
}

function defaultSetupMode(authType: ProviderAuthType): ProviderSetupMode {
  return authType === "api_key" ? "direct_api_key" : "browser_auth"
}

async function fetchProviderCapability(
  client: OutlitClient,
  provider: string,
  json: boolean,
): Promise<SetupCapability> {
  try {
    const result = (await client.callTool("outlit_integration_capabilities", {
      provider,
    })) as { provider?: SetupCapability | null }

    if (!result.provider) {
      return outputError(
        { message: `Unknown integration: "${provider}"`, code: "unknown_provider" },
        json,
      )
    }

    return result.provider
  } catch (err) {
    return outputError(
      { message: errorMessage(err, "Failed to fetch integration capabilities"), code: "api_error" },
      json,
    )
  }
}

async function fetchConnectedIntegration(
  client: OutlitClient,
  capability: SetupCapability,
): Promise<IntegrationListItem | null> {
  try {
    const result = await client.callTool("outlit_list_integrations", {
      connectedOnly: true,
    })
    const items = normalizeIntegrationList(result)
    return (
      items.find((item) => {
        const id = item.id ?? item.provider ?? item.providerId
        return id === capability.cliName || id === capability.providerId
      }) ?? null
    )
  } catch {
    return null
  }
}

function normalizeIntegrationList(result: unknown): IntegrationListItem[] {
  if (Array.isArray(result)) {
    return result.filter(isIntegrationListItem)
  }

  if (!result || typeof result !== "object") {
    return []
  }

  const record = result as Record<string, unknown>
  for (const key of ["items", "integrations", "providers"]) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value.filter(isIntegrationListItem)
    }
  }

  return []
}

function isIntegrationListItem(value: unknown): value is IntegrationListItem {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseConfigOrExit(
  rawConfig: string,
  fields: ConfigField[],
  json: boolean,
): Record<string, string> {
  let config: Record<string, string>

  try {
    const parsed: unknown = JSON.parse(rawConfig)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return outputError(
        { message: "Invalid JSON in --config. Expected a JSON object.", code: "invalid_config" },
        json,
      )
    }
    config = parsed as Record<string, string>
  } catch {
    return outputError(
      { message: "Invalid JSON in --config. Expected a JSON object.", code: "invalid_config" },
      json,
    )
  }

  const missing = fields.filter((field) => !config[field.key])
  if (missing.length > 0) {
    return outputError(
      {
        message: `Missing required fields: ${missing.map((field) => field.key).join(", ")}`,
        code: "invalid_config",
      },
      json,
    )
  }

  return config
}

function parseFollowUpConfigOrExit(rawConfig: string, json: boolean): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(rawConfig)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return outputError(
        { message: "Invalid JSON in --config. Expected a JSON object.", code: "invalid_config" },
        json,
      )
    }
    return parsed as Record<string, unknown>
  } catch {
    return outputError(
      { message: "Invalid JSON in --config. Expected a JSON object.", code: "invalid_config" },
      json,
    )
  }
}

function buildConfigTemplate(fields: ConfigField[]): string {
  const template = Object.fromEntries(fields.map((field) => [field.key, "..."]))
  return JSON.stringify(template)
}

function buildConnectedNextActions(cliName: string, capability: ProviderCapability): string[] {
  const actions = [`outlit integrations status ${cliName} --json`]
  for (const step of capability.postConnectSteps) {
    if (step.supported && step.command) actions.push(`${step.command} --json`)
  }
  return actions
}
