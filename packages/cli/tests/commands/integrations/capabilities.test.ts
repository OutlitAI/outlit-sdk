import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, params: Record<string, unknown>) => {
  const providers = [
    {
      cliName: "hubspot",
      providerId: "hubspot",
      authType: "oauth",
      setupMode: "nango_connect",
      credentialType: "oauth",
      connectSupported: true,
      commands: [
        "outlit integrations capabilities hubspot",
        "outlit integrations setup hubspot",
        "outlit integrations status --session <sessionId>",
      ],
      postConnectSteps: [{ id: "crm-mapping", supported: true }],
    },
    {
      cliName: "attio",
      providerId: "attio",
      authType: "oauth",
      setupMode: "nango_connect",
      credentialType: "oauth",
      connectSupported: true,
      commands: ["outlit integrations setup attio"],
      postConnectSteps: [{ id: "crm-mapping", supported: true }],
    },
    {
      cliName: "pylon",
      providerId: "pylon",
      authType: "api_key",
      setupMode: "direct_api_key",
      credentialType: "api_token",
      connectSupported: true,
      requiredFields: [{ key: "apiToken", label: "API Token", secret: true }],
      commands: ["outlit integrations setup pylon", "outlit integrations status pylon"],
      postConnectSteps: [{ id: "webhook-setup", supported: true }],
    },
  ]

  if (params.provider) {
    const provider = providers.find((item) => item.cliName === params.provider)
    return { provider }
  }

  return { providers }
})

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

  test("lists provider capabilities from the platform API", async () => {
    const { default: capabilitiesCmd } = await import(
      "../../../src/commands/integrations/capabilities"
    )
    const parsed = await captureStdout<{
      providers: Array<{ cliName: string; providerId: string; connectSupported: boolean }>
    }>(() =>
      capabilitiesCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof capabilitiesCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_integration_capabilities", {})
    expect(parsed.providers.map((provider) => provider.cliName)).toContain("attio")
    expect(parsed.providers).toContainEqual(
      expect.objectContaining({
        cliName: "pylon",
        providerId: "pylon",
        connectSupported: true,
      }),
    )
  })

  test("shows single provider lifecycle commands", async () => {
    const { default: capabilitiesCmd } = await import(
      "../../../src/commands/integrations/capabilities"
    )
    const parsed = await captureStdout<{
      provider: {
        cliName: string
        authType: string
        commands: string[]
        postConnectSteps: Array<{ id: string; supported: boolean }>
      }
    }>(() =>
      capabilitiesCmd.run!({
        args: { provider: "hubspot", json: true },
      } as Parameters<NonNullable<typeof capabilitiesCmd.run>>[0]),
    )

    expect(parsed.provider.cliName).toBe("hubspot")
    expect(parsed.provider.authType).toBe("oauth")
    expect(parsed.provider.commands).toContain("outlit integrations setup hubspot")
    expect(parsed.provider.commands).toContain("outlit integrations status --session <sessionId>")
    expect(parsed.provider.postConnectSteps).toContainEqual(
      expect.objectContaining({ id: "crm-mapping", supported: true }),
    )
  })
})
