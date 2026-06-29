import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "agent.createFromTemplate",
  commandVersion: 1,
  correlationId: "corr_123",
  result: {
    operationId: "agent.template.create",
    status: "completed",
    resources: [{ type: "agent", id: "agent_123" }],
    data: {
      agentId: "agent_123",
      templateKey: "churn",
      templateVersion: "2026-06-01",
      mode: "draft",
      created: true,
      safety: {
        actionGrantsAdded: [],
        destinationsAdded: [],
        schedulesAdded: [],
        externalEgressAdded: [],
        enabledAutomation: false,
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

describe("agents create-from-template", () => {
  useTempEnv("agents-create-from-template-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("creates an agent template in draft mode and outputs the command envelope", async () => {
    const { default: createFromTemplateCmd } = await import(
      "../../../src/commands/agents/create-from-template"
    )
    const parsed = await captureStdout<typeof mockEnvelope>(() =>
      createFromTemplateCmd.run!({
        args: { template: "churn", json: true },
      } as Parameters<NonNullable<typeof createFromTemplateCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_create_from_template", {
      source: { type: "template", templateKey: "churn" },
      mode: "draft",
    })
    expect(parsed).toEqual(mockEnvelope)
    expect(parsed.result.data.safety).toEqual({
      actionGrantsAdded: [],
      destinationsAdded: [],
      schedulesAdded: [],
      externalEgressAdded: [],
      enabledAutomation: false,
    })
  })
})
