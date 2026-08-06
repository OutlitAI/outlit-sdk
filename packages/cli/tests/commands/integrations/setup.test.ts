import { beforeEach, describe, expect, mock, test } from "bun:test"
import { runCommand } from "citty"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (toolName: string, input: Record<string, unknown>) => {
  if (toolName === "outlit_get_integration_capabilities") {
    const provider = String(input.provider)
    const humanControlled = provider === "pylon"
    return {
      providers: [
        {
          provider,
          name: provider === "stripe" ? "Stripe" : humanControlled ? "Pylon" : "HubSpot",
          category: provider === "stripe" ? "billing" : humanControlled ? "support" : "crm",
          authType: humanControlled ? "api_key" : "oauth",
          setupMode: humanControlled ? "human_controlled" : "browser_handoff",
          browserHandoffAvailable: !humanControlled,
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

  test("uses the Core-advertised OAuth handoff for Stripe", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout<{
      status: string
      provider: string
      state: string
      sessionId: string
    }>(() => setup.run!({ args: { provider: "stripe", json: true } } as never))

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_get_integration_capabilities", {
      provider: "stripe",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_begin_integration_setup", {
      provider: "stripe",
    })
    expect(result).toMatchObject({
      status: "awaiting_auth",
      provider: "stripe",
      state: "handoff_ready",
      sessionId: "00000000-0000-4000-8000-000000000001",
    })
  })

  test("sends human-controlled providers to the authored UI without credentials", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout<{ status: string; controlPlaneUrl: string }>(() =>
      setup.run!({ args: { provider: "pylon", json: true } } as never),
    )

    expect(result.status).toBe("human_controlled")
    expect(result.controlPlaneUrl).toBe("https://app.outlit.ai/integrations")
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("does not expose config, force, or setup-step arguments", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    expect(Object.keys(setup.args ?? {})).toEqual(["api-key", "json", "provider"])
  })

  test.each([
    ["a legacy Stripe API key", ["stripe", "--stripe-api-key", "rk_test"]],
    ["a legacy Stripe webhook secret", ["stripe", "--webhook-secret", "whsec_test"]],
    ["an extra positional value", ["stripe", "rk_test"]],
  ])("rejects %s before requesting an OAuth handoff", async (_label, rawArgs) => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")

    await runExpectingError(async () => {
      await runCommand(setup, { rawArgs: [...rawArgs, "--json"] })
    }, "invalid_input")

    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
