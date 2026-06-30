import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "settings.notifications.test",
  commandVersion: 1,
  correlationId: "corr_settings_notifications_123",
  result: {
    operationId: "settings.notifications.test",
    status: "completed",
    resources: [],
    data: {},
    warnings: [],
  },
}

const mockCallTool = mock(
  async (_toolName: string, _params: Record<string, unknown>) => mockEnvelope,
)

mock.module("../../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("settings notifications command", () => {
  useTempEnv("settings-notifications-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("exposes notification settings commands", async () => {
    const { default: notificationsCmd } = await import(
      "../../../../src/commands/settings/notifications"
    )
    const subcommands = Object.keys(notificationsCmd.subCommands ?? {})

    expect(subcommands).toEqual(["get", "options", "default"])
    expect(subcommands).not.toContain("default-set")
  })

  test("gets notification settings and options", async () => {
    const { default: getCmd } = await import("../../../../src/commands/settings/notifications/get")
    const { default: optionsCmd } = await import(
      "../../../../src/commands/settings/notifications/options"
    )

    await captureStdout(() =>
      getCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0]),
    )
    await captureStdout(() =>
      optionsCmd.run!({
        args: { search: "ops", limit: "12", json: true },
      } as Parameters<NonNullable<typeof optionsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_settings_notifications_get", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_settings_notifications_options", {
      search: "ops",
      limit: 12,
    })
  })
})
