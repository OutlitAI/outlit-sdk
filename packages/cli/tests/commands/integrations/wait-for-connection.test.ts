import { beforeEach, describe, expect, mock, test } from "bun:test"

let pollResult: unknown = null
let pollOptions: Record<string, unknown> | undefined

const mockPollUntil = mock(
  async <T>(
    fn: () => Promise<T>,
    predicate: (value: T) => boolean,
    options: Record<string, unknown>,
  ): Promise<T | null> => {
    pollOptions = options
    const result = await fn()
    if (pollResult === null) return null
    expect(predicate(result)).toBe(true)
    return result
  },
)

mock.module("../../../src/lib/poll", () => ({ pollUntil: mockPollUntil }))

describe("waitForIntegrationConnection", () => {
  beforeEach(() => {
    pollResult = { status: "connected" }
    pollOptions = undefined
    mockPollUntil.mockClear()
  })

  test("polls only the actor-bound setup session for at most five minutes", async () => {
    const callTool = mock(async () => ({ provider: "hubspot", status: "connected" }))
    const { waitForIntegrationConnection } = await import(
      "../../../src/commands/integrations/wait-for-connection"
    )

    await waitForIntegrationConnection({
      client: { key: "unused", baseUrl: "https://app.outlit.ai", callTool } as never,
      sessionId: "00000000-0000-4000-8000-000000000001",
      displayName: "HubSpot",
    })

    expect(callTool).toHaveBeenCalledWith("outlit_get_integration_setup_status", {
      sessionId: "00000000-0000-4000-8000-000000000001",
    })
    expect(pollOptions).toMatchObject({ intervalMs: 2_000, timeoutMs: 300_000 })
  })

  test("throws a typed timeout when the session stays pending for five minutes", async () => {
    pollResult = null
    const callTool = mock(async () => ({ provider: "hubspot", status: "pending" }))
    const { IntegrationAuthTimeoutError, waitForIntegrationConnection } = await import(
      "../../../src/commands/integrations/wait-for-connection"
    )

    await expect(
      waitForIntegrationConnection({
        client: { key: "unused", baseUrl: "https://app.outlit.ai", callTool } as never,
        sessionId: "00000000-0000-4000-8000-000000000001",
        displayName: "HubSpot",
      }),
    ).rejects.toBeInstanceOf(IntegrationAuthTimeoutError)
  })

  test.each(["expired", "failed"])("throws a typed auth error for %s sessions", async (status) => {
    pollResult = { status }
    const callTool = mock(async () => ({ provider: "hubspot", status }))
    const { IntegrationAuthError, waitForIntegrationConnection } = await import(
      "../../../src/commands/integrations/wait-for-connection"
    )

    await expect(
      waitForIntegrationConnection({
        client: { key: "unused", baseUrl: "https://app.outlit.ai", callTool } as never,
        sessionId: "00000000-0000-4000-8000-000000000001",
        displayName: "HubSpot",
      }),
    ).rejects.toBeInstanceOf(IntegrationAuthError)
  })
})
