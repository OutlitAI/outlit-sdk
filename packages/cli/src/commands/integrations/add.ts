import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import type { OutlitClient } from "../../lib/client"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"
import { pollUntil } from "../../lib/poll"
import type { ProviderInfo } from "../../lib/providers"
import { PROVIDER_NAMES, resolveProviderOrExit } from "../../lib/providers"
import { createSpinner } from "../../lib/spinner"
import { isInteractive, openBrowser, promptInput } from "../../lib/tty"

interface ConnectResponse {
  sessionId: string
  alreadyConnected: boolean
}

interface ConnectStatusResponse {
  status: "pending" | "connected" | "failed" | "expired"
  provider?: string
  error?: string
}

export default defineCommand({
  meta: {
    name: "add",
    description: [
      "Connect a new integration.",
      "",
      "For OAuth providers (Slack, Gmail, etc.), opens the browser for authentication.",
      "For API-key providers (Stripe, PostHog, etc.), accepts credentials via --config or interactive prompts.",
      "",
      "Examples:",
      "  outlit integrations add slack",
      '  outlit integrations add stripe --config \'{"apiKey": "rk_xxx"}\'',
      "  outlit integrations add posthog --json          # outputs required fields as JSON",
      "  outlit integrations add slack --force            # reconnect if already connected",
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
      description: "Integration provider to connect",
      required: true,
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
    const client = await getClientOrExit(args["api-key"], json)
    const { provider, cliName } = resolveProviderOrExit(args.provider, json)

    if (provider.authType === "api_key") {
      await addApiKeyProvider(client, provider, cliName, json, args.config as string | undefined)
    } else {
      await addOAuthProvider(client, provider, cliName, json, !!args.force)
    }
  },
})

/** Handles the API-key provider flow: --config JSON, interactive prompts, or config_required output. */
async function addApiKeyProvider(
  client: OutlitClient,
  provider: ProviderInfo,
  cliName: string,
  json: boolean,
  rawConfig: string | undefined,
): Promise<void> {
  const fields = provider.configFields ?? []
  let config: Record<string, string>

  if (rawConfig) {
    // Parse --config JSON
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

    // Validate all required fields are present
    const missing = fields.filter((f) => !config[f.key])
    if (missing.length > 0) {
      return outputError(
        {
          message: `Missing required fields: ${missing.map((f) => f.key).join(", ")}`,
          code: "invalid_config",
        },
        json,
      )
    }
  } else if (isInteractive() && !isJsonMode(json)) {
    // Interactive prompt for each field
    console.log(`\n  Configure ${provider.name}:\n`)
    config = {}
    for (const field of fields) {
      config[field.key] = await promptInput(`  ${field.label}`, { secret: field.secret })
    }
    console.log()
  } else {
    // Non-interactive without --config: output required fields
    return outputResult({
      status: "config_required",
      provider: cliName,
      message: `${provider.name} requires API key configuration. Pass --config with the required fields.`,
      requiredFields: fields.map((f) => ({ key: f.key, label: f.label })),
    })
  }

  // Send config to the API
  const spinner = createSpinner(`Connecting ${provider.name}...`)
  try {
    await client.callTool("outlit_connect_integration", {
      provider: provider.id,
      config,
    })

    spinner.stop(`${provider.name} connected successfully!`)

    if (isJsonMode(json)) {
      return outputResult({
        status: "connected",
        provider: cliName,
      })
    }
    console.log(`    Use \`outlit integrations status ${cliName}\` to check sync progress.`)
  } catch (err) {
    spinner.fail(`Failed to connect ${provider.name}`)
    return outputError(
      { message: errorMessage(err, "Failed to connect integration"), code: "api_error" },
      json,
    )
  }
}

/** Handles the OAuth provider flow: browser-based auth with polling. */
async function addOAuthProvider(
  client: OutlitClient,
  provider: ProviderInfo,
  cliName: string,
  json: boolean,
  force: boolean,
): Promise<void> {
  const spinner = createSpinner(`Connecting ${provider.name}...`)
  let connectData: ConnectResponse

  try {
    connectData = (await client.callTool("outlit_connect_integration", {
      provider: provider.id,
    })) as ConnectResponse
  } catch (err) {
    spinner.fail(`Failed to initiate ${provider.name} connection`)
    return outputError(
      { message: errorMessage(err, "Failed to start connection flow"), code: "api_error" },
      json,
    )
  }

  // Handle already-connected case
  if (connectData.alreadyConnected && !force) {
    spinner.stop(`${provider.name} is already connected`)
    if (isJsonMode(json)) {
      return outputResult({
        status: "already_connected",
        provider: cliName,
        message: `${provider.name} is already connected. Use --force to reconnect.`,
      })
    }
    console.log(`\n  ${provider.name} is already connected.`)
    console.log(`  To reconnect, run: outlit integrations add ${cliName} --force`)
    return
  }

  // Open the integrations page (not the old /cli/connect URL)
  const integrationsUrl = `${client.baseUrl}/integrations`

  spinner.update(`Opening browser for ${provider.name} authentication...`)
  const opened = openBrowser(integrationsUrl)

  if (!opened) {
    spinner.stop("Could not open browser automatically")
    if (isJsonMode(json)) {
      return outputResult({
        status: "browser_failed",
        provider: cliName,
        url: integrationsUrl,
        sessionId: connectData.sessionId,
      })
    }
    console.log(`\n  Open this URL in your browser to connect ${provider.name}:`)
    console.log(`  ${integrationsUrl}\n`)
  } else {
    spinner.stop(`Browser opened for ${provider.name} authentication`)
  }

  // In JSON mode, return immediately (agents can poll separately)
  if (isJsonMode(json)) {
    return outputResult({
      status: "awaiting_auth",
      provider: cliName,
      sessionId: connectData.sessionId,
    })
  }

  // Interactive mode: poll until connected or timeout
  await waitForConnection(client, connectData.sessionId, provider, cliName)
}

/** Polls the connect status endpoint until the OAuth flow completes or times out. */
async function waitForConnection(
  client: OutlitClient,
  sessionId: string,
  provider: ProviderInfo,
  cliName: string,
): Promise<void> {
  const spinner = createSpinner(`Waiting for ${provider.name} authentication...`)

  const result = await pollUntil<ConnectStatusResponse>(
    () =>
      client
        .callTool("outlit_connect_status", { sessionId })
        .then((r) => r as ConnectStatusResponse),
    (r) => r.status !== "pending",
    {
      intervalMs: 2_000,
      timeoutMs: 300_000,
      spinner,
      spinnerMessage: `Waiting for ${provider.name} authentication...`,
    },
  )

  if (!result || result.status === "expired") {
    spinner.fail("Connection timed out")
    console.log(`\n  The authentication session expired.`)
    console.log(`  Run \`outlit integrations add ${cliName}\` to try again.`)
    process.exit(1)
  }

  if (result.status === "failed") {
    spinner.fail(`${provider.name} connection failed`)
    if (result.error) console.log(`\n  ${result.error}`)
    process.exit(1)
  }

  spinner.stop(`${provider.name} connected successfully!`)
  console.log(`    Sync will begin automatically.`)
  console.log(`    Use \`outlit integrations status ${cliName}\` to check progress.`)
}
