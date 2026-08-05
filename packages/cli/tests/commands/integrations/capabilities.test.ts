import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const providers = [
  {
    provider: "hubspot",
    name: "HubSpot",
    category: "crm",
    authType: "oauth",
    setupMode: "browser_handoff",
    browserHandoffAvailable: true,
  },
  {
    provider: "pylon",
    name: "Pylon",
    category: "support",
    authType: "api_key",
    setupMode: "human_controlled",
    browserHandoffAvailable: false,
  },
]

const mockCallTool = mock(async (_toolName: string, params: Record<string, unknown>) => ({
  providers: params.provider
    ? providers.filter((provider) => provider.provider === params.provider)
    : providers,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations capabilities", () => {
  useTempEnv("integrations-capabilities-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists safe setup modes from the gateway", async () => {
    const { default: command } = await import("../../../src/commands/integrations/capabilities")
    const parsed = await captureStdout<{ providers: typeof providers }>(() =>
      command.run!({ args: { json: true } } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_capabilities", {})
    expect(parsed.providers).toEqual(providers)
    expect(JSON.stringify(parsed)).not.toMatch(/requiredFields|postConnectSteps|credential/)
  })

  test("passes provider filtering to the catalog capability", async () => {
    const { default: command } = await import("../../../src/commands/integrations/capabilities")
    const parsed = await captureStdout<{ providers: typeof providers }>(() =>
      command.run!({ args: { provider: "hubspot", json: true } } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_capabilities", {
      provider: "hubspot",
    })
    expect(parsed.providers).toEqual([providers[0]!])
  })
})
