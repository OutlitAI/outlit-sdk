import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockEnvelope = {
  ok: true,
  commandId: "identity.mergeSuggestion.test",
  commandVersion: 1,
  correlationId: "corr_identity_123",
  result: {
    operationId: "identity.mergeSuggestion.test",
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

describe("identity commands", () => {
  useTempEnv("identity-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("exposes identity suggestion commands", async () => {
    const { default: identityCmd } = await import("../../../src/commands/identity")
    const { default: suggestionsCmd } = await import("../../../src/commands/identity/suggestions")
    const metaSource = identityCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)

    expect(Object.keys(identityCmd.subCommands ?? {})).toEqual(["suggestions"])
    expect(Object.keys(suggestionsCmd.subCommands ?? {})).toEqual([
      "list",
      "get",
      "queue",
      "reject",
    ])
    expect(meta?.description).toContain("identity suggestions list")
    expect(meta?.description).toContain("identity suggestions queue")
  })

  test("routes identity suggestion commands to platform tools", async () => {
    const { default: listCmd } = await import("../../../src/commands/identity/suggestions/list")
    const { default: getCmd } = await import("../../../src/commands/identity/suggestions/get")
    const { default: queueCmd } = await import("../../../src/commands/identity/suggestions/queue")
    const { default: rejectCmd } = await import("../../../src/commands/identity/suggestions/reject")

    await captureStdout(() =>
      listCmd.run!({
        args: { status: "suggested", confidence: "HIGH", limit: "5", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )
    await captureStdout(() =>
      getCmd.run!({
        args: { id: "proposal_123", json: true },
      } as Parameters<NonNullable<typeof getCmd.run>>[0]),
    )
    await captureStdout(() =>
      queueCmd.run!({
        args: { id: "proposal_123", "review-notes": "reviewed by agent", json: true },
      } as Parameters<NonNullable<typeof queueCmd.run>>[0]),
    )
    await captureStdout(() =>
      rejectCmd.run!({
        args: { id: "proposal_123", json: true },
      } as Parameters<NonNullable<typeof rejectCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_identity_merge_suggestion_list", {
      status: "suggested",
      confidence: "HIGH",
      limit: 5,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_identity_merge_suggestion_get", {
      id: "proposal_123",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_identity_merge_suggestion_queue", {
      id: "proposal_123",
      reviewNotes: "reviewed by agent",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(4, "outlit_identity_merge_suggestion_reject", {
      id: "proposal_123",
    })
  })
})
