import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const signalId = "10000000-0000-4000-8000-000000000002"
const mockEnvelope = {
  ok: true,
  commandId: "signal.list",
  commandVersion: 1,
  correlationId: "corr_signal_list_123",
  result: {
    operationId: "signal.list",
    status: "completed",
    resources: [{ type: "signal", id: signalId }],
    data: {
      signals: [
        {
          id: signalId,
          key: "signal:usage-drop",
          managedBy: "UI",
          name: "Usage drop",
          description: null,
          kind: "EVENT_MATCH",
          definition: { eventNames: ["workspace_inactive"] },
          schemaVersion: "2026-06-10",
          configHash: "signal_hash",
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

describe("signals list", () => {
  useTempEnv("signals-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists signals through the platform action endpoint", async () => {
    const { default: listCmd } = await import("../../../src/commands/signals/list")
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_signal_list", {})
    expect(parsed.result.data.signals[0]).toMatchObject({
      id: signalId,
      kind: "EVENT_MATCH",
    })
  })
})
