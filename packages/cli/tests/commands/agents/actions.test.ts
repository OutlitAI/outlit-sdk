import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: Record<string, unknown>) => ({
  ok: true,
  commandId: "agent.listAvailableActions",
  commandVersion: 1,
  correlationId: "corr_actions_123",
  result: {
    operationId: "agent.availableActions.list",
    status: "completed",
    resources: [],
    data: {
      actions: [
        {
          key: "send_slack_notification",
          version: 1,
          label: "Send Slack notification",
          category: "notification",
          subjectTypes: ["CUSTOMER"],
        },
      ],
    },
    warnings: [],
  },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("agents actions", () => {
  useTempEnv("agents-actions-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists available agent configuration actions", async () => {
    const { default: actionsCmd } = await import("../../../src/commands/agents/actions")
    const parsed = await captureStdout<{
      result: {
        data: { actions: Array<{ key: string; version: number; category: string }> }
      }
    }>(() =>
      actionsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof actionsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_list_available_actions", {})
    expect(parsed.result.data.actions[0]).toMatchObject({
      key: "send_slack_notification",
      version: 1,
      category: "notification",
    })
  })
})
