import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockResult = { destination: { id: "destination_123" } }
const mockCallTool = mock(
  async (_toolName: string, _params: Record<string, unknown>): Promise<unknown> => mockResult,
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
          "is-default": true,
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
          enabled: "false",
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateDestinationCmd.run!({
        args: {
          id: destinationId,
          type: "slack",
          "is-default": true,
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_create_destination", {
      type: "slack_channel",
      channelId: "C0123456789",
      label: "#customer-ops",
      enabled: true,
      isDefault: true,
      requestId: expect.any(String),
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_update_destination", {
      id: destinationId,
      label: "#updated-ops",
      enabled: false,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_update_destination", {
      id: destinationId,
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

  test("updates without a destination type, which Core knows", async () => {
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")

    await captureStdout(() =>
      updateDestinationCmd.run!({
        args: {
          id: "10000000-0000-4000-8000-000000000003",
          label: "#updated-ops",
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_destination", {
      id: "10000000-0000-4000-8000-000000000003",
      label: "#updated-ops",
    })
  })

  test("list --ids reads specific destinations", async () => {
    const { default: listCmd } = await import("../../src/commands/destinations/list")

    await captureStdout(() =>
      listCmd.run!({
        args: { ids: "destination_1, destination_2", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_destinations", {
      ids: ["destination_1", "destination_2"],
    })
  })

  test("update takes --enabled true or false and --revision, and refuses a disabled default", async () => {
    const { default: updateCmd } = await import("../../src/commands/destinations/update")
    const id = "10000000-0000-4000-8000-000000000003"

    await captureStdout(() =>
      updateCmd.run!({
        args: { id, enabled: "false", revision: "rev_1", json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )
    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_destination", {
      id,
      enabled: false,
      revision: "rev_1",
    })

    await runExpectingError(
      () =>
        updateCmd.run!({
          args: { id, enabled: "maybe", json: true },
        } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
      "invalid_input",
    )
  })

  test("archive previews, then confirms with the preview token under --yes", async () => {
    const id = "10000000-0000-4000-8000-000000000003"
    mockCallTool.mockImplementationOnce(async () => ({
      archived: false,
      preview: { token: "preview_token_1", expiresAt: "2026-07-28T00:15:00.000Z" },
      impact: { destination: { name: "#customer-ops" }, routes: 2 },
      next: { instruction: "Nothing was archived; to do it, call again with this input" },
    }))
    mockCallTool.mockImplementationOnce(async () => ({
      archived: true,
      destination: { id, archivedAt: "2026-07-28T00:00:00.000Z" },
    }))
    const { default: archiveCmd } = await import("../../src/commands/destinations/archive")

    const result = await captureStdout(() =>
      archiveCmd.run!({
        args: { id, yes: true, json: true },
      } as Parameters<NonNullable<typeof archiveCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_archive_destination", {
      id,
      requestId: expect.any(String),
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_archive_destination", {
      id,
      mode: "execute",
      previewToken: "preview_token_1",
      requestId: expect.any(String),
    })
    expect(result).toMatchObject({ archived: true })
  })

  test("archive without --yes outside a terminal archives nothing and exits with the preview", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      archived: false,
      preview: { token: "preview_token_1", expiresAt: "2026-07-28T00:15:00.000Z" },
      impact: { destination: { name: "#customer-ops" }, routes: 0 },
      next: { instruction: "Nothing was archived; to do it, call again with this input" },
    }))
    const { default: archiveCmd } = await import("../../src/commands/destinations/archive")

    await runExpectingError(
      () =>
        archiveCmd.run!({
          args: { id: "10000000-0000-4000-8000-000000000003", json: true },
        } as Parameters<NonNullable<typeof archiveCmd.run>>[0]),
      "confirmation_required",
    )
    expect(mockCallTool).toHaveBeenCalledTimes(1)
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
            enabled: "true",
            json: true,
          },
        } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
