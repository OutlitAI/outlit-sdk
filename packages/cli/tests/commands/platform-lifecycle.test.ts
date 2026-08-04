import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "platform.lifecycle",
  commandVersion: 1,
  correlationId: "corr_lifecycle_123",
  result: {
    operationId: "platform.lifecycle",
    status: "completed",
    resources: [],
    data: {},
    warnings: [],
  },
}

const mockCallTool = mock(
  async (_toolName: string, _params: Record<string, unknown>) => mockEnvelope,
)

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("platform lifecycle commands", () => {
  useTempEnv("platform-lifecycle-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("runs destination create and update commands", async () => {
    const { default: createDestinationCmd } = await import("../../src/commands/destinations/create")
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")
    const destinationId = "10000000-0000-4000-8000-000000000003"

    await captureStdout(() =>
      createDestinationCmd.run!({
        args: {
          type: "slack",
          "channel-id": "C0123456789",
          label: "#customer-ops",
          default: true,
          json: true,
        },
      } as Parameters<NonNullable<typeof createDestinationCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateDestinationCmd.run!({
        args: {
          id: destinationId,
          type: "slack",
          label: "#updated-ops",
          disabled: true,
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateDestinationCmd.run!({
        args: {
          id: destinationId,
          type: "slack",
          default: true,
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_destination_create", {
      type: "SLACK_CHANNEL",
      channelId: "C0123456789",
      label: "#customer-ops",
      enabled: true,
      isDefault: true,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_destination_update", {
      id: destinationId,
      type: "SLACK_CHANNEL",
      label: "#updated-ops",
      enabled: false,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_destination_update", {
      id: destinationId,
      type: "SLACK_CHANNEL",
      isDefault: true,
    })
  })

  test("requires at least one destination update field", async () => {
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")

    await runExpectingError(
      () =>
        updateDestinationCmd.run!({
          args: {
            id: "10000000-0000-4000-8000-000000000003",
            type: "slack",
            json: true,
          },
        } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
      "missing_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("requires an explicit destination update type", async () => {
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")

    await runExpectingError(
      () =>
        updateDestinationCmd.run!({
          args: {
            id: "10000000-0000-4000-8000-000000000003",
            label: "#updated-ops",
            json: true,
          },
        } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
      "missing_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects unsupported destination update types", async () => {
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")

    await runExpectingError(
      () =>
        updateDestinationCmd.run!({
          args: {
            id: "10000000-0000-4000-8000-000000000003",
            type: "webhook",
            label: "#updated-ops",
            enabled: true,
            json: true,
          },
        } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
