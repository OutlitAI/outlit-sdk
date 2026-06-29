import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "agent.list",
  commandVersion: 1,
  correlationId: "corr_agents_list_123",
  result: {
    operationId: "agent.list",
    status: "completed",
    resources: [{ type: "agent", id: "agent_123" }],
    data: {
      agents: [
        {
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

describe("agents list", () => {
  useTempEnv("agents-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists agents through the platform action endpoint", async () => {
    const { default: listCmd } = await import("../../../src/commands/agents/list")
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_list", {})
    expect(parsed.result.data.agents[0]).toMatchObject({
      id: "agent_123",
      agentKey: "custom:template:churn",
      status: "DISABLED",
    })
  })
})
