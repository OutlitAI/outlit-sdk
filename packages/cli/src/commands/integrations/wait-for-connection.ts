import type { OutlitClient } from "../../lib/client"
import { pollUntil } from "../../lib/poll"
import { createSpinner } from "../../lib/spinner"

type SetupSessionStatus = "expired" | "pending" | "connected" | "failed"

interface SetupSessionStatusResponse {
  provider: string | null
  status: SetupSessionStatus
}

interface WaitForConnectionOptions {
  client: OutlitClient
  sessionId: string
  displayName: string
}

export class IntegrationAuthTimeoutError extends Error {
  constructor() {
    super("Integration authentication timed out after 5 minutes.")
    this.name = "IntegrationAuthTimeoutError"
  }
}

export class IntegrationAuthError extends Error {
  readonly status: "expired" | "failed"

  constructor(status: "expired" | "failed") {
    super(`Integration authentication ${status}.`)
    this.name = "IntegrationAuthError"
    this.status = status
  }
}

/** Polls only the actor-bound compatibility setup session until authentication completes. */
export async function waitForIntegrationConnection({
  client,
  sessionId,
  displayName,
}: WaitForConnectionOptions): Promise<void> {
  const spinner = createSpinner(`Waiting for ${displayName} authentication...`)

  const result = await pollUntil<SetupSessionStatusResponse>(
    () =>
      client
        .callTool("outlit_get_integration_setup_status", { sessionId })
        .then((response) => response as SetupSessionStatusResponse),
    (response) => response.status !== "pending",
    {
      intervalMs: 2_000,
      timeoutMs: 300_000,
      spinner,
      spinnerMessage: `Waiting for ${displayName} authentication...`,
    },
  )

  if (!result) {
    spinner.fail("Connection timed out")
    throw new IntegrationAuthTimeoutError()
  }

  if (result.status === "expired" || result.status === "failed") {
    spinner.fail(`${displayName} authentication ${result.status}`)
    throw new IntegrationAuthError(result.status)
  }

  if (result.status !== "connected") {
    spinner.fail("Connection timed out")
    throw new IntegrationAuthTimeoutError()
  }

  spinner.stop(`${displayName} authentication completed`)
}
