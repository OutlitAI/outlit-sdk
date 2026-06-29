import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const destinationId = "10000000-0000-4000-8000-000000000003"
const mockEnvelope = {
  ok: true,
  commandId: "destination.list",
  commandVersion: 1,
  correlationId: "corr_destination_list_123",
  result: {
    operationId: "destination.list",
    status: "completed",
    resources: [{ type: "destination", id: destinationId }],
    data: {
      destinations: [
        {
          id: destinationId,
          key: "webhook:ops",
          name: "Ops webhook",
          description: null,
          provider: "OUTPOST",
          kind: "WEBHOOK_ENDPOINT",
          enabled: true,
          configJson: { url: "https://hooks.example.com/raw-secret" },
          maskedConfig: { url: "https://hooks.example.com/..." },
          syncStatus: "SYNCED",
          lastSyncedAt: null,
          providerErrorCode: null,
          providerErrorMessage: null,
          isDefault: false,
          schemaVersion: "2026-06-10",
          configHash: "destination_hash",
          archivedAt: null,
          createdAt: "2026-06-28T12:00:00.000Z",
          updatedAt: "2026-06-28T12:00:00.000Z",
        },
      ],
    },
    warnings: [],
  },
}

const mockCallTool = mock(
  async (_toolName: string, _params: Record<string, unknown>) => mockEnvelope,
)

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("destinations list", () => {
  useTempEnv("destinations-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists destinations through the platform action endpoint", async () => {
    const { default: listCmd } = await import("../../../src/commands/destinations/list")

    expect(mockEnvelope.result.data.destinations[0]).toHaveProperty("configJson")

    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_destination_list", {})
    expect(parsed.result.data.destinations[0]).toMatchObject({
      id: destinationId,
      provider: "OUTPOST",
      maskedConfig: { url: "https://hooks.example.com/..." },
    })
    expect(parsed.result.data.destinations[0]).not.toHaveProperty("configJson")
  })
})
