import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (toolName: string, input: Record<string, unknown>) => {
  if (toolName === "outlit_get_integration_capabilities") {
    const provider = String(input.provider)
    return {
      providers: [
        {
          provider,
          name: provider === "stripe" ? "Stripe" : "HubSpot",
          category: provider === "stripe" ? "billing" : "crm",
          authType: provider === "stripe" ? "api_key" : "oauth",
          setupMode: provider === "stripe" ? "human_controlled" : "browser_handoff",
          browserHandoffAvailable: provider !== "stripe",
        },
      ],
    }
  }
  if (toolName === "outlit_begin_integration_setup") {
    return {
      provider: input.provider,
      state: "handoff_ready",
      sessionId: "00000000-0000-4000-8000-000000000001",
      connectUrl: "https://app.outlit.ai/integrations/connect",
      expiresAt: "2026-08-04T22:00:00.000Z",
    }
  }
  throw new Error(`unexpected tool ${toolName}`)
})

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations setup", () => {
  useTempEnv("integrations-setup-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("starts only the model-safe browser handoff", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await captureStdout(() => setup.run!({ args: { provider: "hubspot", json: true } } as never))

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_get_integration_capabilities", {
      provider: "hubspot",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_begin_integration_setup", {
      provider: "hubspot",
    })
  })

  test("sends human-controlled providers to the authored UI without credentials", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout<{ status: string; controlPlaneUrl: string }>(() =>
      setup.run!({ args: { provider: "stripe", json: true } } as never),
    )

    expect(result.status).toBe("human_controlled")
    expect(result.controlPlaneUrl).toBe("https://app.outlit.ai/integrations")
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("does not expose config, force, or setup-step arguments", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    expect(Object.keys(setup.args ?? {})).toEqual(["api-key", "json", "provider"])
  })
})
