import type { OutlitClient } from "../../lib/client"
import { pollUntil } from "../../lib/poll"
import { createSpinner } from "../../lib/spinner"

interface ConnectStatusResponse {
  status: "pending" | "connected" | "failed" | "expired"
  provider?: string
  error?: string
}

interface WaitForConnectionOptions {
  client: OutlitClient
  sessionId: string
  displayName: string
  cliName: string
  retryCommand: string
}

/** Polls the connect status endpoint until the OAuth flow completes or times out. */
export async function waitForIntegrationConnection({
  client,
  sessionId,
  displayName,
  cliName,
  retryCommand,
}: WaitForConnectionOptions): Promise<void> {
  const spinner = createSpinner(`Waiting for ${displayName} authentication...`)

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
      spinnerMessage: `Waiting for ${displayName} authentication...`,
    },
  )

  if (!result || result.status === "expired") {
    spinner.fail("Connection timed out")
    console.log(`\n  The authentication session expired.`)
    console.log(`  Run \`${retryCommand}\` to try again.`)
    process.exit(1)
  }

  if (result.status === "failed") {
    spinner.fail(`${displayName} connection failed`)
    if (result.error) console.log(`\n  ${result.error}`)
    process.exit(1)
  }

  spinner.stop(`${displayName} connected successfully!`)
  console.log(`    Sync will begin automatically.`)
  console.log(`    Use \`outlit integrations status ${cliName}\` to check progress.`)
}
