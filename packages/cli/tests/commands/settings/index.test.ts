import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockResult = { settings: { defaultTimezone: "America/Los_Angeles" } }

const mockCallTool = mock(async (_toolName: string, _params: Record<string, unknown>) => mockResult)

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

    expect(subcommands).toEqual(["get", "update"])
    expect(subcommands).not.toContain("default-timezone")
    expect(meta?.description).not.toContain("settings report")
    expect(meta?.description).not.toContain("destinations options")
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
        args: { timezone: "America/Los_Angeles", json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_get_settings", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_update_settings", {
      timezone: "America/Los_Angeles",
    })
  })

  test("update sends the activation event, a default owner, a revision, and none as null", async () => {
    const { default: updateCmd } = await import("../../../src/commands/settings/update")
    const run = (args: Record<string, unknown>) =>
      captureStdout(() =>
        updateCmd.run!({ args: { json: true, ...args } } as Parameters<
          NonNullable<typeof updateCmd.run>
        >[0]),
      )

    await run({ "activation-event": " integration_connected ", revision: "settings_revision_v1_x" })
    await run({ "activation-event": "none", "default-owner": "NONE" })
    await run({ "default-owner": "sandy@example.com" })

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_update_settings", {
      activationEvent: "integration_connected",
      revision: "settings_revision_v1_x",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_update_settings", {
      activationEvent: null,
      defaultOwner: null,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_update_settings", {
      defaultOwner: "sandy@example.com",
    })
  })

  test("update with nothing to change exits before calling Core", async () => {
    const { default: updateCmd } = await import("../../../src/commands/settings/update")

    await runExpectingError(
      () =>
        updateCmd.run!({ args: { json: true } } as Parameters<
          NonNullable<typeof updateCmd.run>
        >[0]),
      "missing_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
