import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "automation.list",
  commandVersion: 1,
  correlationId: "corr_automation_list_123",
  result: {
    operationId: "automation.list",
    status: "completed",
    resources: [{ type: "automation", id: "10000000-0000-4000-8000-000000000001" }],
    data: {
      automations: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          key: "automation:churn-agent",
          managedBy: "UI",
          name: "Churn agent",
          description: null,
          enabled: false,
          triggerType: "SIGNAL_OCCURRENCE",
          triggerJson: { signalIds: [] },
          audienceFilterJson: null,
          outcomeType: "AGENT_PROCESSOR",
          processorJson: { organizationAgentId: "agent_123" },
          processorPolicyJson: null,
          deliveryPolicyJson: null,
          matchMode: "ANY",
          schemaVersion: "2026-06-10",
          configHash: "automation_hash",
          archivedAt: null,
          lastRunAt: null,
          lastRunStatus: null,
          nextRunAt: null,
          createdAt: "2026-06-28T12:00:00.000Z",
          updatedAt: "2026-06-28T12:00:00.000Z",
          signals: [],
          destinations: [],
          activeSignalCount: 0,
          activeDestinationCount: 0,
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

describe("automations list", () => {
  useTempEnv("automations-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists automations through the platform action endpoint", async () => {
    const { default: listCmd } = await import("../../../src/commands/automations/list")
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_automation_list", {})
    expect(parsed.result.data.automations[0]).toMatchObject({
      id: "10000000-0000-4000-8000-000000000001",
      key: "automation:churn-agent",
      enabled: false,
    })
  })
})
