import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "agent.get",
  commandVersion: 1,
  correlationId: "corr_agent_get_123",
  result: {
    operationId: "agent.get",
    status: "completed",
    resources: [{ type: "agent", id: "agent_123" }],
    data: {
      agent: {
        id: "agent_123",
        agentKey: "custom:template:churn",
        displayName: "Churn prevention",
        status: "DISABLED",
        templateVersion: "2026-06-01",
        actionKeys: [],
        schedule: {
          enabled: false,
          nextRunAt: null,
          lastRunAt: null,
          lastSuccessfulRunAt: null,
        },
        createdAt: "2026-06-28T12:00:00.000Z",
        updatedAt: "2026-06-28T12:00:00.000Z",
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

describe("agents get", () => {
  useTempEnv("agents-get-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("gets one agent through the platform action endpoint", async () => {
    const { default: getCmd } = await import("../../../src/commands/agents/get")
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      getCmd.run!({
        args: { id: "agent_123", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_get", { id: "agent_123" })
    expect(parsed.result.data.agent).toMatchObject({
      id: "agent_123",
      agentKey: "custom:template:churn",
      status: "DISABLED",
    })
  })
})
