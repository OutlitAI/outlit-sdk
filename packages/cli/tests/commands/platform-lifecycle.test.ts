import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../helpers"

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

  test("runs agent lifecycle commands through platform action tools", async () => {
    const { default: enableCmd } = await import("../../src/commands/agents/enable")
    const { default: disableCmd } = await import("../../src/commands/agents/disable")
    const { default: renameCmd } = await import("../../src/commands/agents/rename")

    await captureStdout(() =>
      enableCmd.run!({
        args: { id: "agent_123", json: true },
      } as Parameters<NonNullable<typeof enableCmd.run>>[0]),
    )
    await captureStdout(() =>
      disableCmd.run!({
        args: { id: "agent_123", json: true },
      } as Parameters<NonNullable<typeof disableCmd.run>>[0]),
    )
    await captureStdout(() =>
      renameCmd.run!({
        args: { id: "agent_123", displayName: "Renamed", json: true },
      } as Parameters<NonNullable<typeof renameCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_agent_enable", { id: "agent_123" })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_agent_disable", { id: "agent_123" })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_agent_rename", {
      id: "agent_123",
      displayName: "Renamed",
    })
  })

  test("runs automation, signal, and destination lifecycle commands", async () => {
    const { default: automationArchiveCmd } = await import("../../src/commands/automations/archive")
    const { default: signalGetCmd } = await import("../../src/commands/signals/get")
    const { default: signalArchiveCmd } = await import("../../src/commands/signals/archive")
    const { default: destinationDisableCmd } = await import(
      "../../src/commands/destinations/disable"
    )
    const automationId = "10000000-0000-4000-8000-000000000001"
    const signalId = "10000000-0000-4000-8000-000000000002"
    const destinationId = "10000000-0000-4000-8000-000000000003"

    await captureStdout(() =>
      automationArchiveCmd.run!({
        args: { id: automationId, json: true },
      } as Parameters<NonNullable<typeof automationArchiveCmd.run>>[0]),
    )
    await captureStdout(() =>
      signalGetCmd.run!({
        args: { id: signalId, json: true },
      } as Parameters<NonNullable<typeof signalGetCmd.run>>[0]),
    )
    await captureStdout(() =>
      signalArchiveCmd.run!({
        args: { id: signalId, json: true },
      } as Parameters<NonNullable<typeof signalArchiveCmd.run>>[0]),
    )
    await captureStdout(() =>
      destinationDisableCmd.run!({
        args: { id: destinationId, json: true },
      } as Parameters<NonNullable<typeof destinationDisableCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_automation_archive", {
      id: automationId,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_signal_get", { id: signalId })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_signal_archive", { id: signalId })
    expect(mockCallTool).toHaveBeenNthCalledWith(4, "outlit_destination_disable", {
      id: destinationId,
    })
  })
})
