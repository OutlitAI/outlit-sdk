import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (toolName: string, params: Record<string, unknown>) => {
  if (toolName === "outlit_integration_capabilities") {
    const provider = params.provider
    if (provider === "stripe") {
      return {
        provider: {
          cliName: "stripe",
          providerId: "brex-api-key",
          authType: "api_key",
          setupMode: "direct_api_key",
          credentialType: "api_key",
          connectSupported: true,
          requiredFields: [{ key: "apiKey", label: "API Key", secret: true }],
          postConnectSteps: [],
        },
      }
    }
    if (provider === "granola") {
      return {
        provider: {
          cliName: "granola",
          providerId: "granola",
          authType: "api_key",
          setupMode: "direct_api_key",
          credentialType: "api_key",
          connectSupported: true,
          requiredFields: [{ key: "apiKey", label: "API Key", secret: true }],
          postConnectSteps: [],
        },
      }
    }
    if (provider === "pylon") {
      return {
        provider: {
          cliName: "pylon",
          providerId: "pylon",
          authType: "api_key",
          setupMode: "direct_api_key",
          credentialType: "api_token",
          connectSupported: true,
          requiredFields: [{ key: "apiToken", label: "API Token", secret: true }],
          postConnectSteps: [
            {
              id: "webhook-setup",
              label: "Configure Pylon realtime webhooks",
              required: true,
              supported: true,
              command: "outlit integrations setup pylon webhooks",
            },
          ],
        },
      }
    }
    return {
      provider: {
        cliName: provider,
        providerId: provider,
        authType: "oauth",
        setupMode: "nango_connect",
        credentialType: "oauth",
        connectSupported: true,
        requiredFields: [],
        postConnectSteps: [
          {
            id: "crm-mapping",
            label: "Configure CRM pipeline and stage mappings",
            required: true,
            supported: true,
            command: `outlit integrations setup ${provider} mappings`,
          },
        ],
      },
    }
  }

  if (toolName === "outlit_integration_setup_step") {
    return {
      status: "manual_setup_required",
      provider: params.provider,
      step: params.step === "crm-mapping" ? "crm-mapping" : "webhook-setup",
      connectionId: `${params.provider}-org_123`,
      setup: {
        mode: "manual",
        webhookUrl: `https://app.outlit.ai/api/webhooks/${params.provider}`,
      },
      nextActions: [`outlit integrations status ${params.provider} --json`],
    }
  }

  return {
    sessionId: "sess_123",
    alreadyConnected: false,
    connectUrl: `https://app.outlit.ai/integrations?provider=${params.provider}`,
  }
})

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

const mockOpenBrowser = mock(() => true)
mock.module("../../../src/lib/tty", () => {
  return {
    isCiEnvironment: () =>
      process.env.CI === "true" || process.env.CI === "1" || Boolean(process.env.GITHUB_ACTIONS),
    isInteractive: () =>
      Boolean(process.stdin.isTTY) &&
      Boolean(process.stdout.isTTY) &&
      process.env.CI !== "true" &&
      process.env.CI !== "1" &&
      !process.env.GITHUB_ACTIONS &&
      process.env.TERM !== "dumb",
    isUnicodeSupported: true,
    openBrowser: mockOpenBrowser,
    promptInput: mock(async () => ""),
  }
})

describe("integrations setup", () => {
  useTempEnv("integrations-setup-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    mockOpenBrowser.mockClear()
  })

  test("starts OAuth setup and returns pollable session details", async () => {
    const { default: setupCmd } = await import("../../../src/commands/integrations/setup")
    const parsed = await captureStdout<{
      status: string
      provider: string
      connectUrl: string
      sessionId: string
      nextActions: string[]
    }>(() =>
      setupCmd.run!({
        args: { provider: "hubspot", json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
      provider: "hubspot",
    })
    expect(parsed.status).toBe("awaiting_auth")
    expect(parsed.provider).toBe("hubspot")
    expect(parsed.connectUrl).toBe("https://app.outlit.ai/integrations?provider=hubspot")
    expect(parsed.sessionId).toBe("sess_123")
    expect(parsed.nextActions).toContain("outlit integrations status --session sess_123 --json")
  })

  test("returns API-key requirements without config", async () => {
    const { default: setupCmd } = await import("../../../src/commands/integrations/setup")
    const parsed = await captureStdout<{
      status: string
      provider: string
      requiredFields: Array<{ key: string; label: string; secret?: boolean }>
      nextActions: string[]
    }>(() =>
      setupCmd.run!({
        args: { provider: "stripe", json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0]),
    )

    expect(parsed.status).toBe("config_required")
    expect(parsed.provider).toBe("stripe")
    expect(parsed.requiredFields).toEqual([{ key: "apiKey", label: "API Key", secret: true }])
    expect(parsed.nextActions).toContain(
      'outlit integrations setup stripe --config \'{"apiKey":"..."}\' --json',
    )
  })

  test("connects granola through API-key setup", async () => {
    const { default: setupCmd } = await import("../../../src/commands/integrations/setup")
    const parsed = await captureStdout(() =>
      setupCmd.run!({
        args: {
          provider: "granola",
          config: '{"apiKey": "gr_test_123"}',
          json: true,
        },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
      provider: "granola",
      config: { apiKey: "gr_test_123" },
    })
    expect(parsed).toEqual(
      expect.objectContaining({
        status: "connected",
        provider: "granola",
      }),
    )
  })

  test("connects Pylon through API-token setup and reports webhook follow-up", async () => {
    const { default: setupCmd } = await import("../../../src/commands/integrations/setup")
    const parsed = await captureStdout<{
      status: string
      provider: string
      capabilities: {
        authType: string
        setupMode: string
        credentialType: string
        postConnectSteps: Array<{ id: string; supported: boolean }>
      }
    }>(() =>
      setupCmd.run!({
        args: {
          provider: "pylon",
          config: '{"apiToken": "pylon_test_token"}',
          json: true,
        },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
      provider: "pylon",
      config: { apiToken: "pylon_test_token" },
    })
    expect(parsed.status).toBe("connected")
    expect(parsed.provider).toBe("pylon")
    expect(parsed.capabilities.authType).toBe("api_key")
    expect(parsed.capabilities.setupMode).toBe("direct_api_key")
    expect(parsed.capabilities.credentialType).toBe("api_token")
    expect(parsed.capabilities.postConnectSteps).toContainEqual(
      expect.objectContaining({ id: "webhook-setup", supported: true }),
    )
  })

  test("runs provider follow-up setup through the Core setup-step API", async () => {
    const { default: setupCmd } = await import("../../../src/commands/integrations/setup")
    const parsed = await captureStdout<{
      status: string
      provider: string
      step: string
      nextActions: string[]
    }>(() =>
      setupCmd.run!({
        args: { provider: "pylon", step: "webhooks", json: true },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0]),
    )

    expect(mockCallTool).not.toHaveBeenCalledWith("outlit_connect_integration", expect.anything())
    expect(mockCallTool).toHaveBeenCalledWith("outlit_integration_setup_step", {
      provider: "pylon",
      step: "webhook-setup",
    })
    expect(parsed).toEqual(
      expect.objectContaining({
        status: "manual_setup_required",
        provider: "pylon",
        step: "webhook-setup",
      }),
    )
    expect(parsed.nextActions).toContain("outlit integrations status pylon --json")
  })

  test("passes follow-up setup config through to Core", async () => {
    const { default: setupCmd } = await import("../../../src/commands/integrations/setup")
    await captureStdout(() =>
      setupCmd.run!({
        args: {
          provider: "hubspot",
          step: "mappings",
          config: '{"mappings":[]}',
          json: true,
        },
      } as Parameters<NonNullable<typeof setupCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_integration_setup_step", {
      provider: "hubspot",
      step: "crm-mapping",
      config: { mappings: [] },
    })
  })
})
