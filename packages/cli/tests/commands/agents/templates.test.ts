import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: Record<string, unknown>) => ({
  ok: true,
  commandId: "agent.listTemplates",
  commandVersion: 1,
  correlationId: "corr_templates_123",
  result: {
    operationId: "agent.templates.list",
    status: "completed",
    resources: [],
    data: {
      templates: [
        {
          key: "churn",
          version: "2026-06-01",
          name: "Churn risk",
          description: "Find churn risk",
          creates: ["agent", "signal", "automation"],
          defaultMode: "draft",
          supportedModes: ["draft"],
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

describe("agents templates", () => {
  useTempEnv("agents-templates-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists agent templates through the platform action endpoint", async () => {
    const { default: templatesCmd } = await import("../../../src/commands/agents/templates")
    const parsed = await captureStdout<{
      result: {
        data: { templates: Array<{ key: string; version: string; defaultMode: string }> }
      }
    }>(() =>
      templatesCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof templatesCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_agent_list_templates", {})
    expect(parsed.result.data.templates[0]).toMatchObject({
      key: "churn",
      version: "2026-06-01",
      defaultMode: "draft",
    })
  })
})
