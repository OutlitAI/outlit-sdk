import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  sessionId: "sess_123",
  alreadyConnected: false,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

const mockOpenBrowser = mock(() => true)
mock.module("../../../src/lib/tty", () => {
  const actual = require("../../../src/lib/tty")
  return {
    ...actual,
    openBrowser: mockOpenBrowser,
  }
})

describe("integrations add", () => {
  useTempEnv("integrations-add-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
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

    test("returns awaiting_auth without connectUrl in JSON mode", async () => {
      const { default: addCmd } = await import("../../../src/commands/integrations/add")
      const parsed = await captureStdout(() =>
        addCmd.run!({
          args: { provider: "slack", json: true },
        } as Parameters<NonNullable<typeof addCmd.run>>[0]),
      )

      expect(parsed.status).toBe("awaiting_auth")
      expect(parsed.provider).toBe("slack")
      expect(parsed.sessionId).toBe("sess_123")
      // connectUrl is no longer in the response
      expect(parsed.connectUrl).toBeUndefined()
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
