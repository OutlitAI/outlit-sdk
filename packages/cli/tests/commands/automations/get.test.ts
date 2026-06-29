import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const automationId = "10000000-0000-4000-8000-000000000001"
const mockEnvelope = {
  ok: true,
  commandId: "automation.get",
  commandVersion: 1,
  correlationId: "corr_automation_get_123",
  result: {
    operationId: "automation.get",
    status: "completed",
    resources: [{ type: "automation", id: automationId }],
    data: {
      automation: {
        id: automationId,
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

describe("automations get", () => {
  useTempEnv("automations-get-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("gets one automation through the platform action endpoint", async () => {
    const { default: getCmd } = await import("../../../src/commands/automations/get")
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      getCmd.run!({
        args: { id: automationId, json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_automation_get", { id: automationId })
    expect(parsed.result.data.automation).toMatchObject({
      id: automationId,
      key: "automation:churn-agent",
    })
  })
})
