import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(
  async (_toolName: string, _params: unknown): Promise<Record<string, unknown>> => ({
    sessionId: "sess_123",
    alreadyConnected: false,
    connectUrl: "https://app.outlit.ai/integrations?provider=slack",
  }),
)

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

describe("integrations add", () => {
  useTempEnv("integrations-add-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    mockOpenBrowser.mockClear()
  })

  test("rejects unknown provider", async () => {
    const { default: addCmd } = await import("../../../src/commands/integrations/add")
    await runExpectingError(
      () =>
        addCmd.run!({
          args: { provider: "unknown-thing", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      "unknown_provider",
    )
  })

  // --- OAuth provider tests ---

  describe("OAuth providers", () => {
    test("calls outlit_connect_integration with correct provider id", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await captureStdout(() =>
        addCmd.run!({
          args: { provider: "slack", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "slack",
      })
    })

    test("resolves gmail alias to google-mail", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await captureStdout(() =>
        addCmd.run!({
          args: { provider: "gmail", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "google-mail",
      })
    })

    test("resolves attio to its platform provider id", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await captureStdout(() =>
        addCmd.run!({
          args: { provider: "attio", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "attio",
      })
    })

    test("returns already_connected status without --force", async () => {
      mockCallTool.mockImplementationOnce(async () => ({
        sessionId: "sess_123",
        alreadyConnected: true,
      }))

      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "slack", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("already_connected")
    })

    test("proceeds when already connected with --force", async () => {
      mockCallTool.mockImplementationOnce(async () => ({
        sessionId: "sess_123",
        alreadyConnected: true,
      }))

      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "slack", force: true, json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("awaiting_auth")
      expect(parsed.sessionId).toBe("sess_123")
    })

    test("returns awaiting_auth with connectUrl in JSON mode", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "slack", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("awaiting_auth")
      expect(parsed.provider).toBe("slack")
      expect(parsed.sessionId).toBe("sess_123")
      expect(parsed.connectUrl).toBe("https://app.outlit.ai/integrations?provider=slack")
    })

    test("returns browser_failed when browser cannot open", async () => {
      mockOpenBrowser.mockReturnValueOnce(false)

      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "slack", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("browser_failed")
      expect(parsed.url).toBeDefined()
      expect(parsed.sessionId).toBe("sess_123")
    })

    test("exits 1 when API call fails", async () => {
      mockCallTool.mockImplementationOnce(async () => {
        throw new Error("API error (500): Internal Server Error")
      })

      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await runExpectingError(
        () =>
          addCmd.run!({
            args: { provider: "slack", json: true },
          } as Parameters<NonNullable<typeof addCmd.run>>[0]),
        "api_error",
      )
    })
  })

  // --- API-key provider tests ---

  describe("API-key providers", () => {
    test("connects stripe with --config JSON", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: {
            provider: "stripe",
            config: '{"apiKey": "rk_test_123"}',
            json: true,
          },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "brex-api-key",
        config: { apiKey: "rk_test_123" },
      })
      expect(parsed.status).toBe("connected")
      expect(parsed.provider).toBe("stripe")
    })

    test("connects posthog with multi-field --config", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const config = JSON.stringify({ apiKey: "phx_test", region: "us", projectId: "123" })
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "posthog", config, json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "posthog",
        config: { apiKey: "phx_test", region: "us", projectId: "123" },
      })
      expect(parsed.status).toBe("connected")
    })

    test("connects granola with API key config", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: {
            provider: "granola",
            config: '{"apiKey": "gr_test_123"}',
            json: true,
          },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "granola",
        config: { apiKey: "gr_test_123" },
      })
      expect(parsed.status).toBe("connected")
      expect(parsed.provider).toBe("granola")
    })

    test("connects pylon with API token config", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: {
            provider: "pylon",
            config: '{"apiToken": "pylon_test_token"}',
            json: true,
          },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "pylon",
        config: { apiToken: "pylon_test_token" },
      })
      expect(parsed.status).toBe("connected")
      expect(parsed.provider).toBe("pylon")
    })

    test("outputs config_required for pylon API token setup", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "pylon", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("config_required")
      expect(parsed.provider).toBe("pylon")
      expect(parsed.requiredFields).toEqual([{ key: "apiToken", label: "API Token" }])
      expect(mockCallTool).not.toHaveBeenCalled()
    })

    test("outputs config_required in JSON mode when no --config provided", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "stripe", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("config_required")
      expect(parsed.provider).toBe("stripe")
      expect(parsed.requiredFields).toEqual([{ key: "apiKey", label: "API Key" }])
    })

    test("outputs config_required for posthog with all fields", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "posthog", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("config_required")
      expect(parsed.requiredFields).toHaveLength(3)
      expect((parsed.requiredFields as { key: string }[]).map((f) => f.key)).toEqual([
        "apiKey",
        "region",
        "projectId",
      ])
    })

    test("rejects invalid JSON in --config", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await runExpectingError(
        () =>
          addCmd.run!({
            args: { provider: "stripe", config: "not-json", json: true },
          } as Parameters<NonNullable<typeof addCmd.run>>[0]),
        "invalid_config",
      )
    })

    test("rejects --config with missing required fields", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await runExpectingError(
        () =>
          addCmd.run!({
            args: {
              provider: "posthog",
              config: '{"apiKey": "phx_test"}',
              json: true,
            },
          } as Parameters<NonNullable<typeof addCmd.run>>[0]),
        "invalid_config",
      )
    })

    test("connects supabase with --config", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const config = JSON.stringify({
        projectUrl: "https://abc.supabase.co",
        serviceRoleKey: "eyJ...",
      })
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "supabase", config, json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "supabase",
        config: { projectUrl: "https://abc.supabase.co", serviceRoleKey: "eyJ..." },
      })
      expect(parsed.status).toBe("connected")
    })

    test("connects clerk with --config", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: {
            provider: "clerk",
            config: '{"secretKey": "sk_test_abc123"}',
            json: true,
          },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(mockCallTool).toHaveBeenCalledWith("outlit_connect_integration", {
        provider: "clerk",
        config: { secretKey: "sk_test_abc123" },
      })
      expect(parsed.status).toBe("connected")
    })

    test("exits 1 when API call fails for API-key provider", async () => {
      mockCallTool.mockImplementationOnce(async () => {
        throw new Error("API error (400): Invalid API key")
      })

      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      await runExpectingError(
        () =>
          addCmd.run!({
            args: {
              provider: "stripe",
              config: '{"apiKey": "rk_bad"}',
              json: true,
            },
          } as Parameters<NonNullable<typeof addCmd.run>>[0]),
        "api_error",
      )
    })
  })
})
