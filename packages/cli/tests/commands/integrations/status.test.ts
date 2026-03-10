import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

// Set up the branching mock response based on tool name
mockCallTool.mockImplementation(async (toolName: string, _params: unknown) => {
  if (toolName === "outlit_integration_sync_status") {
    return {
      syncs: [
        { model: "Opportunity", status: "syncing", recordCount: 150, lastSyncedAt: null },
        {
          model: "Contact",
          status: "complete",
          recordCount: 3200,
          lastSyncedAt: new Date().toISOString(),
        },
      ],
    }
  }
  return {
    items: [
      {
        name: "Salesforce",
        category: "crm",
        syncStatus: "active",
        lastDataReceivedAt: new Date().toISOString(),
      },
      { name: "Slack", category: "communication", syncStatus: "idle", lastDataReceivedAt: null },
    ],
  }
})

describe("integrations status", () => {
  useTempEnv("integrations-status-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    // Re-set the branching mock after mockClear
    mockCallTool.mockImplementation(async (toolName: string, _params: unknown) => {
      if (toolName === "outlit_integration_sync_status") {
        return {
          syncs: [
            { model: "Opportunity", status: "syncing", recordCount: 150, lastSyncedAt: null },
            {
              model: "Contact",
              status: "complete",
              recordCount: 3200,
              lastSyncedAt: new Date().toISOString(),
            },
          ],
        }
      }
      return {
        items: [
          {
            name: "Salesforce",
            category: "crm",
            syncStatus: "active",
            lastDataReceivedAt: new Date().toISOString(),
          },
          {
            name: "Slack",
            category: "communication",
            syncStatus: "idle",
            lastDataReceivedAt: null,
          },
        ],
      }
    })
  })

  test("calls outlit_list_integrations with connectedOnly when no provider given", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await captureStdout(() =>
      statusCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_integrations", {
      connectedOnly: true,
    })
  })

  test("calls outlit_integration_sync_status when provider is given", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await captureStdout(() =>
      statusCmd.run!({
        args: { provider: "salesforce", json: true },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_integration_sync_status", {
      provider: "salesforce",
    })
  })

  test("resolves provider alias for status", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await captureStdout(() =>
      statusCmd.run!({
        args: { provider: "gmail", json: true },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_integration_sync_status", {
      provider: "google-mail",
    })
  })

  test("rejects unknown provider", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await runExpectingError(
      () =>
        statusCmd.run!({
          args: { provider: "nonexistent", json: true },
        } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
      "unknown_provider",
    )
  })

  test("outputs JSON for summary view", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    const parsed = await captureStdout(() =>
      statusCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
    )

    expect(Array.isArray(parsed.items)).toBe(true)
  })

  test("outputs JSON for per-provider detail view", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    const parsed = await captureStdout(() =>
      statusCmd.run!({
        args: { provider: "salesforce", json: true },
      } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
    )

    expect(Array.isArray(parsed.syncs)).toBe(true)
  })

  test("renders table in interactive mode for summary", async () => {
    setInteractive()
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await statusCmd.run!({ args: {} } as Parameters<NonNullable<typeof statusCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Name")
      expect(output).toContain("Sync Status")
      expect(output).toContain("Salesforce")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (401): Unauthorized")
    })

    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await runExpectingError(
      () =>
        statusCmd.run!({
          args: { json: true },
        } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
      "api_error",
    )
  })
})
