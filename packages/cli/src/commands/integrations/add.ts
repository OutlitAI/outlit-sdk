import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit } from "../../lib/api"
import { OUTLIT_INTEGRATIONS_URL } from "../../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"
import { pollUntil } from "../../lib/poll"
import { PROVIDER_NAMES, resolveProvider } from "../../lib/providers"
import { createSpinner } from "../../lib/spinner"
import { openBrowser } from "../../lib/tty"

interface ConnectResponse {
  sessionId: string
  connectUrl: string
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
      "Connect a new integration by opening the browser for OAuth.",
      "",
      "Initiates the connection flow for a third-party service.",
      "A browser window will open for authentication. The CLI waits",
      "for the flow to complete (up to 5 minutes).",
      "",
      "Examples:",
      "  outlit integrations add salesforce",
      "  outlit integrations add gmail",
      "  outlit integrations add slack --force     # reconnect if already connected",
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
  },
  async run({ args }) {
    const json = !!args.json
    const client = await getClientOrExit(args["api-key"], json)

    // Validate provider name
    const resolved = resolveProvider(args.provider)
    if ("error" in resolved) {
      return outputError({ message: resolved.error, code: "unknown_provider" }, json)
    }
    const { provider, cliName } = resolved

    // Initiate connection
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
    if (connectData.alreadyConnected && !args.force) {
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

    // Open browser
    spinner.update(`Opening browser for ${provider.name} authentication...`)
    const opened = openBrowser(connectData.connectUrl)

    if (!opened) {
      spinner.stop("Could not open browser automatically")
      if (isJsonMode(json)) {
        return outputResult({
          status: "browser_failed",
          connectUrl: connectData.connectUrl,
          sessionId: connectData.sessionId,
        })
      }
      console.log(`\n  Open this URL in your browser to connect ${provider.name}:`)
      console.log(`  ${connectData.connectUrl}\n`)
    } else {
      spinner.stop(`Browser opened for ${provider.name} authentication`)
    }

    // In JSON mode, return the connect data immediately (agents can poll separately)
    if (isJsonMode(json)) {
      return outputResult({
        status: "awaiting_auth",
        provider: cliName,
        sessionId: connectData.sessionId,
        connectUrl: connectData.connectUrl,
      })
    }

    // Create a fresh spinner for the polling phase
    const pollSpinner = createSpinner(`Waiting for ${provider.name} authentication...`)

    const result = await pollUntil<ConnectStatusResponse>(
      () =>
        client
          .callTool("outlit_connect_status", { sessionId: connectData.sessionId })
          .then((r) => r as ConnectStatusResponse),
      (r) => r.status !== "pending",
      {
        intervalMs: 2_000,
        timeoutMs: 300_000,
        spinner: pollSpinner,
        spinnerMessage: `Waiting for ${provider.name} authentication...`,
      },
    )

    if (!result || result.status === "expired") {
      pollSpinner.fail("Connection timed out")
      console.log(`\n  The authentication session expired.`)
      console.log(`  Run \`outlit integrations add ${cliName}\` to try again.`)
      process.exit(1)
    }

    if (result.status === "failed") {
      pollSpinner.fail(`${provider.name} connection failed`)
      if (result.error) console.log(`\n  ${result.error}`)
      process.exit(1)
    }

    // Success
    pollSpinner.stop(`${provider.name} connected successfully!`)
    console.log(`    Sync will begin automatically.`)
    console.log(`    Use \`outlit integrations status ${cliName}\` to check progress.`)

    if (provider.category === "crm") {
      console.log(`    For pipeline and field mappings, visit: ${OUTLIT_INTEGRATIONS_URL}`)
    }
  },
})
