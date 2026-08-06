import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import type { OutlitClient } from "../../lib/client"
import { errorMessage, outputError, outputResult } from "../../lib/output"
import { normalizeProviderInput } from "../../lib/providers"
import { createSpinner } from "../../lib/spinner"
import { openBrowser } from "../../lib/tty"
import { waitForIntegrationConnection } from "./wait-for-connection"

type SetupCapability = {
  provider: string
  name: string
  category: string
  authType: "oauth" | "api_key" | "basic_auth"
  setupMode: "browser_handoff" | "human_controlled"
  browserHandoffAvailable: boolean
}

type SetupResponse = {
  provider: string
  state: "handoff_ready" | "already_connected"
  sessionId: string | null
  connectUrl: string | null
  expiresAt: string | null
}

export default defineCommand({
  meta: {
    name: "setup",
    description: [
      "Start a safe browser handoff for an integration.",
      "",
      "Credential and provider-specific configuration is completed in the Outlit web app.",
      "Providers without browser handoff support return the human control-plane URL.",
      "",
      "Examples:",
      "  outlit integrations setup slack",
      "  outlit integrations setup hubspot --json",
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
  },
  async run({ args, rawArgs }) {
    const json = !!args.json
    const unsupportedArgument = getUnsupportedSetupArgument(rawArgs ?? [])
    if (unsupportedArgument) {
      return outputError(
        {
          message:
            "Integration setup does not accept provider credentials or additional arguments. Complete provider-specific configuration in the Outlit web app.",
          code: "invalid_input",
        },
        json,
      )
    }

    const provider = normalizeProviderInput(args.provider)
    const client = await getClientOrExit(args["api-key"], json)
    const capability = await fetchProviderCapability(client, provider, json)

    if (!capability.browserHandoffAvailable || capability.setupMode === "human_controlled") {
      return outputResult({
        status: "human_controlled",
        provider: capability.provider,
        controlPlaneUrl: `${client.baseUrl}/integrations`,
        capabilities: capability,
      })
    }

    const spinner = createSpinner(`Starting ${capability.name} setup...`)
    let setup: SetupResponse
    try {
      setup = (await client.callTool("outlit_begin_integration_setup", {
        provider: capability.provider,
      })) as SetupResponse
    } catch (error) {
      spinner.fail(`Failed to start ${capability.name} setup`)
      return outputError(
        { message: errorMessage(error, "Failed to start setup flow"), code: "api_error" },
        json,
      )
    }

    if (setup.state === "already_connected") {
      spinner.stop(`${capability.name} is already connected`)
      return outputResult({ status: "already_connected", ...setup, capabilities: capability })
    }

    if (!json && setup.connectUrl) {
      const opened = openBrowser(setup.connectUrl)
      spinner.stop(opened ? `Browser opened for ${capability.name}` : "Could not open browser")
      if (!opened) console.log(`Open this URL to continue: ${setup.connectUrl}`)
      if (setup.sessionId) {
        await waitForIntegrationConnection({
          client,
          sessionId: setup.sessionId,
          displayName: capability.name,
          cliName: capability.provider,
          retryCommand: `outlit integrations setup ${capability.provider}`,
        })
        return
      }
    } else {
      spinner.stop(`Started ${capability.name} setup`)
    }

    return outputResult({ status: "awaiting_auth", ...setup, capabilities: capability })
  },
})

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

    if (argument.startsWith("--api-key=")) continue
    if (argument === "--json" || argument === "--no-json") continue
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
): Promise<SetupCapability> {
  try {
    const result = (await client.callTool("outlit_get_integration_capabilities", {
      provider,
    })) as { providers?: SetupCapability[] }
    const capability = result.providers?.find((candidate) => candidate.provider === provider)
    if (capability) return capability
    return outputError(
      { message: `Unknown integration: "${provider}"`, code: "unknown_provider" },
      json,
    )
  } catch (error) {
    return outputError(
      {
        message: errorMessage(error, "Failed to fetch integration capabilities"),
        code: "api_error",
      },
      json,
    )
  }
}
