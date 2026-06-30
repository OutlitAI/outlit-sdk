import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "settings.test",
  commandVersion: 1,
  correlationId: "corr_settings_123",
  result: {
    operationId: "settings.test",
    status: "completed",
    resources: [],
    data: {},
    warnings: [],
  },
}

const mockCallTool = mock(
  async (_toolName: string, _params: Record<string, unknown>) => mockEnvelope,
)

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("settings command", () => {
  useTempEnv("settings-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("exposes nested dash-free settings commands", async () => {
    const { default: settingsCmd } = await import("../../../src/commands/settings")
    const subcommands = Object.keys(settingsCmd.subCommands ?? {})
    const metaSource = settingsCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(subcommands).toEqual(["get", "update", "report"])
    expect(subcommands).not.toContain("default-timezone")
    expect(meta?.description).toContain("settings report get")
    expect(meta?.description).toContain("destinations options")
    expect(meta?.description).not.toContain("settings notifications")
  })

  test("gets and updates workspace settings through settings tools", async () => {
    const { default: getCmd } = await import("../../../src/commands/settings/get")
    const { default: updateCmd } = await import("../../../src/commands/settings/update")

    await captureStdout(() =>
      getCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateCmd.run!({
        args: { "default-timezone": "America/Los_Angeles", json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_settings_get", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_settings_update", {
      defaultTimezone: "America/Los_Angeles",
    })
  })
})
