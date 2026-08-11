import { matchesGeneratedJsonSchema, publicToolContracts } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, outputApiError } from "../../lib/api"
import type { OutlitClient } from "../../lib/client"
import { isJsonMode, outputError, outputResult } from "../../lib/output"
import { normalizeProviderInput } from "../../lib/providers"
import { createSpinner } from "../../lib/spinner"
import { openBrowser } from "../../lib/tty"
import {
  collectMixpanelMapping,
  collectProviderCredentials,
  confirmCrmRecommendation,
  hasCrmConfiguration,
  parseSetupConfig,
  readSetupConfigText,
  SetupCancelledError,
  SetupInputError,
  type SetupToolInput,
} from "./setup-input"
import {
  IntegrationAuthError,
  IntegrationAuthTimeoutError,
  waitForIntegrationConnection,
} from "./wait-for-connection"

type SetupCapability = {
  provider: string
  name: string
  category: string
  authType: "oauth" | "api_key" | "basic_auth"
  setupMode: "browser_handoff" | "human_controlled"
  browserHandoffAvailable: boolean
}

type LegacySetupResponse = {
  provider: string
  state: "handoff_ready" | "already_connected"
  sessionId: string | null
  connectUrl: string | null
  expiresAt: string | null
}

type BrowserHandoff = {
  kind: "browser_handoff"
  purpose: "authentication" | "recovery" | "external_setup"
  url: string
  sessionId: string | null
  expiresAt: string | null
}

type CrmMappingNext = {
  kind: "crm_mapping"
  recommendation: unknown[]
}

type MixpanelMappingNext = {
  kind: "mixpanel_mapping"
  preview: { candidateAccountKeys?: Array<{ key: string }> }
}

type SetupResponse = {
  provider: string
  name: string
  category: string
  status: "not_connected" | "awaiting_auth" | "setup_required" | "ready" | "requires_intervention"
  next: BrowserHandoff | CrmMappingNext | MixpanelMappingNext | null
  error: null | { code: string; message: string; retryable: boolean }
}

const setupOutputSchema = publicToolContracts.outlit_setup_integration.outputSchema
const STALLED_MESSAGE = "Integration setup did not reach a terminal state."

export default defineCommand({
  meta: {
    name: "setup",
    description: [
      "Set up or repair an integration through credentials, configuration, or a safe handoff.",
      "",
      "Interactive setup prompts for provider secrets only after Core requests them.",
      "Automation may pass one strict JSON document on stdin with --config-stdin.",
      "Supported actor-owned setup uses integrations:connect_own; workspace or admin setup uses integrations:manage.",
      "",
      "Examples:",
      "  outlit integrations setup slack",
      "  outlit integrations setup hubspot --json",
      "  outlit integrations setup fireflies --config-stdin --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "config-stdin": {
      type: "boolean",
      description: "Read one strict provider configuration JSON document from stdin",
    },
    "accept-recommended": {
      type: "boolean",
      description: "Apply the exact CRM mapping recommendation shown by this command",
    },
    provider: {
      type: "positional",
      description: "Integration provider to set up",
      required: true,
    },
  },
  async run({ args, rawArgs }) {
    const json = !!args.json
    const machineMode = isJsonMode(json)
    const unsupportedArgument = getUnsupportedSetupArgument(rawArgs ?? [])
    if (unsupportedArgument) {
      return outputError(
        {
          message:
            "Integration setup accepts provider configuration only through --config-stdin; provider secrets are never CLI flags.",
          code: "invalid_input",
        },
        json,
      )
    }

    const provider = normalizeProviderInput(args.provider)
    const client = await getClientOrExit(args["api-key"], json)

    const { capability, preferredSetupVersion } = await fetchProviderCapability(
      client,
      provider,
      json,
    )

    if (preferredSetupVersion !== 1) {
      if (args["config-stdin"] || args["accept-recommended"]) {
        return outputError(
          {
            message:
              "This Outlit deployment does not support negotiated setup; --config-stdin and --accept-recommended are unavailable.",
            code: "unsupported_core_version",
          },
          json,
        )
      }
      return runLegacySetup(client, capability, json, machineMode)
    }

    let initialInput: SetupToolInput = { provider: capability.provider }
    if (args["config-stdin"]) {
      try {
        initialInput = parseSetupConfig(await readSetupConfigText(), capability.provider)
      } catch (error) {
        if (error instanceof SetupInputError) {
          return outputError({ message: error.message, code: error.code }, json)
        }
        return outputError(
          {
            message: "Could not read integration configuration from stdin.",
            code: "invalid_input",
          },
          json,
        )
      }
    }

    if (args["accept-recommended"] && hasCrmConfiguration(initialInput)) {
      return outputError(
        {
          message: "--accept-recommended conflicts with a supplied CRM configuration.",
          code: "invalid_input",
        },
        json,
      )
    }

    return runPreferredSetup({
      client,
      input: initialInput,
      json,
      machineMode,
      acceptRecommended: !!args["accept-recommended"],
      suppliedConfig: !!args["config-stdin"],
    })
  },
})

async function runPreferredSetup(options: {
  client: OutlitClient
  input: SetupToolInput
  json: boolean
  machineMode: boolean
  acceptRecommended: boolean
  suppliedConfig: boolean
}): Promise<void> {
  const { client, json, machineMode, acceptRecommended, suppliedConfig } = options
  const provider = options.input.provider
  let input = options.input
  let setupCalls = 0
  let continuationUsed = false
  let mappingUsed = false
  const transitions = new Set<string>()

  while (setupCalls < 3) {
    let response: SetupResponse
    try {
      const raw = await client.callTool("outlit_setup_integration", input)
      setupCalls += 1
      if (!matchesGeneratedJsonSchema(raw, setupOutputSchema)) {
        return invalidSetupResponse(json)
      }
      response = raw as SetupResponse
    } catch (error) {
      return outputApiError(error, json, {
        message: "Integration setup request failed.",
        code: "api_error",
      })
    }

    if (response.error) {
      if (response.error.code !== "CREDENTIAL_REQUIRED") {
        return outputError({ message: response.error.message, code: response.error.code }, json)
      }

      if (continuationUsed || transitions.has("credential")) return stalled(json)

      if (machineMode || suppliedConfig) {
        return outputError({ message: response.error.message, code: response.error.code }, json)
      }

      transitions.add("credential")
      continuationUsed = true
      try {
        input = await collectProviderCredentials(provider)
      } catch (error) {
        if (error instanceof SetupCancelledError || error instanceof SetupInputError) {
          return outputError(
            {
              message: error.message,
              code: error instanceof SetupInputError ? error.code : "SETUP_CANCELLED",
            },
            json,
          )
        }
        return outputError(
          { message: "Could not collect provider credentials.", code: "SETUP_CANCELLED" },
          json,
        )
      }
      continue
    }

    if (!response.next) {
      if (response.status === "ready") return finishSetup(response, machineMode)
      return outputError(
        {
          message: "Integration setup requires attention before it can continue.",
          code: "SETUP_INCOMPLETE",
        },
        json,
      )
    }

    if (response.next.kind === "browser_handoff") {
      let handoffUrl: string
      try {
        handoffUrl = validateHandoffUrl(response.next.url, client.baseUrl)
      } catch {
        return invalidSetupResponse(json)
      }

      if (machineMode) return finishSetup(response, true)

      const opened = openBrowser(handoffUrl)
      if (!opened) console.log(`Open this URL to continue: ${handoffUrl}`)

      if (response.next.purpose !== "authentication" || response.next.sessionId === null) {
        return finishSetup(response, false)
      }

      if (continuationUsed || transitions.has("authentication")) return stalled(json)
      transitions.add("authentication")
      continuationUsed = true
      try {
        await waitForIntegrationConnection({
          client,
          sessionId: response.next.sessionId,
          displayName: response.name,
        })
      } catch (error) {
        if (error instanceof IntegrationAuthTimeoutError) {
          return outputError(
            {
              message: "Integration authentication timed out after 5 minutes.",
              code: "AUTH_TIMEOUT",
            },
            json,
          )
        }
        if (error instanceof IntegrationAuthError) {
          return outputError(
            { message: "Integration authentication failed.", code: "AUTH_FAILED" },
            json,
          )
        }
        return outputApiError(error, json, {
          message: "Integration authentication failed.",
          code: "AUTH_FAILED",
        })
      }

      input = authenticationContinuationInput(input)
      continue
    }

    if (response.next.kind === "crm_mapping") {
      printRecommendation(response.next.recommendation, machineMode)
      if (mappingUsed || transitions.has("crm_mapping")) return stalled(json)

      let shouldApply = acceptRecommended
      if (!acceptRecommended && !machineMode) {
        try {
          shouldApply = await confirmCrmRecommendation()
        } catch (error) {
          if (error instanceof SetupCancelledError) {
            return outputError({ message: error.message, code: "SETUP_CANCELLED" }, json)
          }
          return outputError(
            { message: "Could not confirm the CRM mapping.", code: "SETUP_CANCELLED" },
            json,
          )
        }
      }
      if (!shouldApply) return finishSetup(response, machineMode)

      mappingUsed = true
      transitions.add("crm_mapping")
      input = {
        provider,
        configuration: {
          kind: "crm_mapping",
          mappings: response.next.recommendation,
          confirm: true,
        },
      }
      continue
    }

    if (response.next.kind === "mixpanel_mapping") {
      if (mappingUsed || transitions.has("mixpanel_mapping")) return stalled(json)
      printMixpanelPreview(response.next.preview, machineMode)
      if (machineMode || suppliedConfig) return finishSetup(response, machineMode)

      let mapping: Record<string, string>
      try {
        mapping = await collectMixpanelMapping(response.next.preview.candidateAccountKeys ?? [])
      } catch (error) {
        if (error instanceof SetupCancelledError) {
          return outputError({ message: error.message, code: "SETUP_CANCELLED" }, json)
        }
        return outputError(
          { message: "Could not collect the Mixpanel mapping.", code: "SETUP_CANCELLED" },
          json,
        )
      }
      mappingUsed = true
      transitions.add("mixpanel_mapping")
      input = {
        provider,
        configuration: { kind: "mixpanel_mapping", mapping, confirm: true },
      }
      continue
    }

    return invalidSetupResponse(json)
  }

  return stalled(json)
}

async function runLegacySetup(
  client: OutlitClient,
  capability: SetupCapability,
  json: boolean,
  machineMode: boolean,
): Promise<void> {
  if (!capability.browserHandoffAvailable || capability.setupMode === "human_controlled") {
    const controlPlaneUrl = validateHandoffUrl("/integrations", client.baseUrl)
    return outputResult({
      status: "human_controlled",
      provider: capability.provider,
      controlPlaneUrl,
      capabilities: capability,
    })
  }

  const spinner = machineMode ? null : createSpinner(`Starting ${capability.name} setup...`)
  let setup: LegacySetupResponse
  try {
    setup = (await client.callTool("outlit_begin_integration_setup", {
      provider: capability.provider,
    })) as LegacySetupResponse
  } catch (error) {
    spinner?.fail(`Failed to start ${capability.name} setup`)
    return outputApiError(error, json, {
      message: "Failed to start setup flow.",
      code: "api_error",
    })
  }

  if (setup.state === "already_connected") {
    spinner?.stop(`${capability.name} is already connected`)
    return outputResult({ status: "already_connected", ...setup, capabilities: capability })
  }

  if (!setup.connectUrl) {
    spinner?.fail(`Failed to start ${capability.name} setup`)
    return invalidSetupResponse(json)
  }
  let connectUrl: string
  try {
    connectUrl = validateHandoffUrl(setup.connectUrl, client.baseUrl)
  } catch {
    spinner?.fail(`Failed to start ${capability.name} setup`)
    return invalidSetupResponse(json)
  }

  if (!machineMode) {
    const opened = openBrowser(connectUrl)
    spinner?.stop(opened ? `Browser opened for ${capability.name}` : "Could not open browser")
    if (!opened) console.log(`Open this URL to continue: ${connectUrl}`)
    if (setup.sessionId) {
      try {
        await waitForIntegrationConnection({
          client,
          sessionId: setup.sessionId,
          displayName: capability.name,
        })
      } catch (error) {
        if (
          error instanceof IntegrationAuthTimeoutError ||
          (error instanceof IntegrationAuthError && error.status === "expired")
        ) {
          return outputError(
            {
              message: "Integration authentication timed out after 5 minutes.",
              code: "AUTH_TIMEOUT",
            },
            json,
          )
        }
        return outputError(
          { message: "Integration authentication failed.", code: "AUTH_FAILED" },
          json,
        )
      }
      return
    }
  }

  return outputResult({
    status: "awaiting_auth",
    ...setup,
    connectUrl,
    capabilities: capability,
  })
}

function getUnsupportedSetupArgument(rawArgs: string[]): string | null {
  let foundProvider = false

  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index]
    if (argument === undefined) continue

    if (argument === "--api-key") {
      const value = rawArgs[index + 1]
      if (!value || value.startsWith("-")) return argument
      index += 1
      continue
    }

    if (argument.startsWith("--api-key=")) {
      if (!argument.slice("--api-key=".length)) return argument
      continue
    }
    if (
      argument === "--json" ||
      argument === "--no-json" ||
      argument === "--config-stdin" ||
      argument === "--accept-recommended"
    ) {
      continue
    }
    if (argument.startsWith("-")) return argument

    if (!foundProvider) {
      foundProvider = true
      continue
    }

    return argument
  }

  return null
}

async function fetchProviderCapability(
  client: OutlitClient,
  provider: string,
  json: boolean,
): Promise<{ capability: SetupCapability; preferredSetupVersion?: number }> {
  try {
    const result = (await client.callTool("outlit_get_integration_capabilities", {
      provider,
    })) as { providers?: SetupCapability[]; preferredSetupVersion?: number }
    const capability = result.providers?.find((candidate) => candidate.provider === provider)
    if (capability) {
      return { capability, preferredSetupVersion: result.preferredSetupVersion }
    }
    return outputError(
      { message: `Unknown integration: "${provider}"`, code: "unknown_provider" },
      json,
    )
  } catch (error) {
    return outputApiError(error, json, {
      message: "Failed to fetch integration capabilities.",
      code: "api_error",
    })
  }
}

export function validateHandoffUrl(value: string, configuredBaseUrl: string): string {
  const configured = new URL(configuredBaseUrl)
  const url = new URL(value, configured)
  if (url.origin !== configured.origin) throw new Error("Untrusted integration handoff origin")
  if (url.protocol !== "https:" && !isLoopbackHostname(url.hostname)) {
    throw new Error("Integration handoff must use HTTPS")
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Integration handoff contains unsafe URL credentials or fragment")
  }

  for (const [key, queryValue] of url.searchParams) {
    if (/password|secret|credential|token|api[-_]?key|code/i.test(key)) {
      throw new Error("Integration handoff contains an unsafe query parameter")
    }
    if (/^(?:ok_|rk_|phx_|whsec_)/i.test(queryValue)) {
      throw new Error("Integration handoff contains credential material")
    }
  }

  return url.toString()
}

function authenticationContinuationInput(input: SetupToolInput): SetupToolInput {
  const continuation: SetupToolInput = { provider: input.provider }
  if (input.connectionMode !== undefined) continuation.connectionMode = input.connectionMode
  if (input.configuration !== undefined) continuation.configuration = input.configuration
  return continuation
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return (
    normalized === "localhost" || normalized === "::1" || /^127(?:\.\d{1,3}){3}$/.test(normalized)
  )
}

function printRecommendation(recommendation: unknown, machineMode: boolean): void {
  if (!machineMode) {
    console.log(`Recommended CRM mapping:\n${JSON.stringify(recommendation, null, 2)}`)
  }
}

function printMixpanelPreview(preview: unknown, machineMode: boolean): void {
  if (!machineMode) {
    console.log(`Mixpanel mapping preview:\n${JSON.stringify(preview, null, 2)}`)
  }
}

function finishSetup(response: SetupResponse, machineMode: boolean): void {
  if (machineMode) {
    outputResult(response)
    return
  }
  console.log(`${response.name}: ${response.status}`)
}

function invalidSetupResponse(json: boolean): never {
  return outputError(
    {
      message: "Outlit returned an invalid integration setup response.",
      code: "INVALID_SETUP_RESPONSE",
    },
    json,
  )
}

function stalled(json: boolean): never {
  return outputError({ message: STALLED_MESSAGE, code: "SETUP_STALLED" }, json)
}
