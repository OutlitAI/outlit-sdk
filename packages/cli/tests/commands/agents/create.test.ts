import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "agent.create",
  commandVersion: 1,
  correlationId: "corr_123",
  result: {
    operationId: "agent.create",
    status: "completed",
    resources: [{ type: "agent", id: "agent_123" }],
    data: {
      agent: {
        id: "agent_123",
        key: "hosted-churn",
        displayName: "Churn prevention",
        enabled: false,
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

describe("agents create", () => {
  useTempEnv("agents-create-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("creates an agent template in draft mode and outputs the command envelope", async () => {
    const { default: createCmd } = await import("../../../src/commands/agents/create")
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      createCmd.run!({
        args: { template: "churn", json: true },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_create", {
      type: "template",
      templateKey: "churn",
      mode: "draft",
    })
    expect(parsed).toEqual(mockEnvelope)
  })

  test("creates a custom agent", async () => {
    const { default: createCmd } = await import("../../../src/commands/agents/create")

    await captureStdout(() =>
      createCmd.run!({
        args: {
          type: "custom",
          "display-name": "Renewal risk",
          instructions: "Find risky renewals and skip already resolved issues.",
          "action-keys": "send_slack_notification, create_task",
          json: true,
        },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_create", {
      type: "custom",
      displayName: "Renewal risk",
      instructions: "Find risky renewals and skip already resolved issues.",
      maxItemsToSurface: 10,
      actionKeys: ["send_slack_notification", "create_task"],
    })
  })

  test("rejects ambiguous create modes", async () => {
    const { default: createCmd } = await import("../../../src/commands/agents/create")

    await runExpectingError(
      () =>
        createCmd.run!({
          args: { template: "churn", type: "custom", json: true },
        } as Parameters<NonNullable<typeof createCmd.run>>[0]),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
