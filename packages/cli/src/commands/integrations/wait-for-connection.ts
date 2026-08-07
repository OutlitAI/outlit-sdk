import type { OutlitClient } from "../../lib/client"
import { pollUntil } from "../../lib/poll"
import { createSpinner } from "../../lib/spinner"

const terminalIntegrationStatuses = new Set([
  "not_connected",
  "setup_incomplete",
  "synchronizing",
  "ready",
  "needs_attention",
])

interface IntegrationStatusResponse {
  integrations?: Array<{ status?: string }>
}

interface WaitForConnectionOptions {
  client: OutlitClient
  provider: string
  displayName: string
}

/** Polls the preferred status projection until browser authentication advances or times out. */
export async function waitForIntegrationConnection({
  client,
  provider,
  displayName,
}: WaitForConnectionOptions): Promise<void> {
  const spinner = createSpinner(`Waiting for ${displayName} authentication...`)

  const result = await pollUntil<IntegrationStatusResponse>(
    () =>
      client
        .callTool("outlit_get_integration_status", { provider })
        .then((response) => response as IntegrationStatusResponse),
    (response) => terminalIntegrationStatuses.has(response.integrations?.[0]?.status ?? ""),
    {
      intervalMs: 2_000,
      timeoutMs: 300_000,
      spinner,
      spinnerMessage: `Waiting for ${displayName} authentication...`,
    },
  )

  const status = result?.integrations?.[0]?.status
  if (!result || !status || status === "not_connected") {
    spinner.fail("Connection timed out")
    console.log("\n  Authentication did not complete before the handoff expired.")
    process.exit(1)
  }

  if (status === "needs_attention") {
    spinner.fail(`${displayName} needs attention`)
    process.exit(1)
  }

  spinner.stop(`${displayName} authentication completed`)
  console.log("    Outlit will continue setup and initial synchronization automatically.")
}
