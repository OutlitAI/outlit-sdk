import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(
  async (_toolName: string, _params: unknown): Promise<unknown> => ({
    integrations: [
      {
        provider: "slack",
        name: "Slack",
        category: "communication",
        status: "ready",
        lastDataReceivedAt: new Date().toISOString(),
      },
    ],
  }),
)

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations status", () => {
  useTempEnv("integrations-status-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    mockCallTool.mockImplementation(async () => ({
      integrations: [
        {
          provider: "slack",
          name: "Slack",
          category: "communication",
          status: "ready",
          lastDataReceivedAt: new Date().toISOString(),
        },
      ],
    }))
  })

  test("calls the preferred status tool for the summary", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await captureStdout(() =>
      statusCmd.run!({ args: { json: true } } as Parameters<NonNullable<typeof statusCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_status", {})
  })

  test("calls the preferred status tool for one provider", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await captureStdout(() =>
      statusCmd.run!({ args: { provider: "slack", json: true } } as Parameters<
        NonNullable<typeof statusCmd.run>
      >[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_status", {
      provider: "slack",
    })
  })

  test("does not expose a browser-auth session argument", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    expect(Object.keys(statusCmd.args ?? {})).toEqual(["api-key", "json", "provider"])
  })

  test("passes provider aliases through to Core", async () => {
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await captureStdout(() =>
      statusCmd.run!({ args: { provider: "gmail", json: true } } as Parameters<
        NonNullable<typeof statusCmd.run>
      >[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_status", {
      provider: "gmail",
    })
  })

  test("preserves the concise canonical status in JSON", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      integrations: [
        {
          provider: "hubspot",
          name: "HubSpot",
          category: "crm",
          status: "setup_incomplete",
          lastDataReceivedAt: null,
        },
      ],
    }))

    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    const parsed = await captureStdout(() =>
      statusCmd.run!({ args: { provider: "hubspot", json: true } } as Parameters<
        NonNullable<typeof statusCmd.run>
      >[0]),
    )

    expect(parsed).toEqual({
      integrations: [
        expect.objectContaining({
          status: "setup_incomplete",
          lastDataReceivedAt: null,
        }),
      ],
    })
  })

  test("renders a canonical-state table in interactive mode", async () => {
    setInteractive()
    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await statusCmd.run!({ args: {} } as Parameters<NonNullable<typeof statusCmd.run>>[0])

      const output = logSpy.mock.calls.map((call) => call[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Name")
      expect(output).toContain("Status")
      expect(output).toContain("Slack")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })

  test("exits 1 when the preferred tool fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (401): Unauthorized")
    })

    const { default: statusCmd } = await import("../../../src/commands/integrations/status")
    await runExpectingError(
      () =>
        statusCmd.run!({ args: { json: true } } as Parameters<
          NonNullable<typeof statusCmd.run>
        >[0]),
      "api_error",
    )
  })
})
