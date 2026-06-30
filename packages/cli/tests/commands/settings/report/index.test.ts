import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "settings.report.test",
  commandVersion: 1,
  correlationId: "corr_settings_report_123",
  result: {
    operationId: "settings.report.test",
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

describe("settings report command", () => {
  useTempEnv("settings-report-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("exposes report settings commands", async () => {
    const { default: reportCmd } = await import("../../../../src/commands/settings/report")
    const subcommands = Object.keys(reportCmd.subCommands ?? {})

    expect(subcommands).toEqual(["get", "update", "options"])
    expect(subcommands).not.toContain("slack-channel")
  })

  test("gets, updates, and fetches report settings options", async () => {
    const { default: getCmd } = await import("../../../../src/commands/settings/report/get")
    const { default: updateCmd } = await import("../../../../src/commands/settings/report/update")
    const { default: optionsCmd } = await import("../../../../src/commands/settings/report/options")

    await captureStdout(() =>
      getCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateCmd.run!({
        args: {
          "slack-channel-id": "C123",
          "slack-channel-name": "sales-alerts",
          json: true,
        },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )
    await captureStdout(() =>
      optionsCmd.run!({
        args: { search: "sales", limit: "10", json: true },
      } as Parameters<NonNullable<typeof optionsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_settings_report_get", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_settings_report_update", {
      slackChannelId: "C123",
      slackChannelName: "sales-alerts",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_settings_report_options", {
      search: "sales",
      limit: 10,
    })
  })

  test("rejects partial report Slack channel updates", async () => {
    const { default: updateCmd } = await import("../../../../src/commands/settings/report/update")

    await runExpectingError(
      async () =>
        updateCmd.run!({
          args: {
            "slack-channel-id": "C123",
            json: true,
          },
        } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
      "missing_input",
    )

    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
