import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../../../helpers"

const destinationId = "10000000-0000-4000-8000-000000000003"
const mockEnvelope = {
  ok: true,
  commandId: "settings.notifications.default.test",
  commandVersion: 1,
  correlationId: "corr_settings_notifications_default_123",
  result: {
    operationId: "settings.notifications.default.test",
    status: "completed",
    resources: [{ type: "destination", id: destinationId }],
    data: {},
    warnings: [],
  },
}

const mockCallTool = mock(
  async (_toolName: string, _params: Record<string, unknown>) => mockEnvelope,
)

mock.module("../../../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("settings notifications default command", () => {
  useTempEnv("settings-notifications-default-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("exposes the nested default set command", async () => {
    const { default: defaultCmd } = await import(
      "../../../../../src/commands/settings/notifications/default"
    )
    const subcommands = Object.keys(defaultCmd.subCommands ?? {})

    expect(subcommands).toEqual(["set"])
    expect(subcommands).not.toContain("set-default")
  })

  test("sets the default notification destination", async () => {
    const { default: setCmd } = await import(
      "../../../../../src/commands/settings/notifications/default/set"
    )

    await captureStdout(() =>
      setCmd.run!({
        args: { "destination-id": destinationId, json: true },
      } as Parameters<NonNullable<typeof setCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_settings_notifications_default_set", {
      destinationId,
    })
  })
})
