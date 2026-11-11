import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockResult = { ok: true }
const featureArchivePreview = {
  archived: false,
  preview: { token: "preview_token_1", expiresAt: "2026-07-28T00:15:00.000Z" },
  impact: { feature: { name: "Reports exported" }, activeFeaturesRemaining: 2 },
  next: { instruction: "Nothing was archived; to do it, call again with this input" },
}
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

describe("Feature commands", () => {
  useTempEnv("value-feature-commands-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("reads the workspace with explicit source and bounded discovery inputs", async () => {
    const { default: workspaceCmd } = await import("../../src/commands/features/list")

    await captureStdout(() =>
      workspaceCmd.run!({
        args: {
          source: " metric_source_v1_0123456789abcdef0123456789abcdef ",
          weeks: "4",
          "candidate-limit": "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof workspaceCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_features", {
      filters: { sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef" },
      include: ["usage", "candidates"],
      weeks: 4,
      candidateLimit: 20,
    })
  })

  test("lets Core auto-select a source while applying workspace defaults", async () => {
    const { default: workspaceCmd } = await import("../../src/commands/features/list")

    await captureStdout(() =>
      workspaceCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof workspaceCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_features", {
      include: ["usage", "candidates"],
      weeks: 12,
    })
  })

  test("narrows the sections, the candidates and the page", async () => {
    const { default: workspaceCmd } = await import("../../src/commands/features/list")

    await captureStdout(() =>
      workspaceCmd.run!({
        args: { include: "candidates", search: " export ", limit: "5", cursor: "abc", json: true },
      } as Parameters<NonNullable<typeof workspaceCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_features", {
      filters: { eventSearch: "export" },
      include: ["candidates"],
      weeks: 12,
      limit: 5,
      cursor: "abc",
    })
  })

  test("creates one Feature while preserving the exact discovered event name", async () => {
    const { default: createCmd } = await import("../../src/commands/features/create")

    await captureStdout(() =>
      createCmd.run!({
        args: {
          "source-key": " metric_source_v1_0123456789abcdef0123456789abcdef ",
          "event-name": " Report Exported ",
          "feature-key": " reports_exported ",
          name: " Reports exported ",
          "property-filters": JSON.stringify([
            {
              property: "environment",
              operator: "equals",
              value: { type: "string", value: "production" },
            },
          ]),
          json: true,
        },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_create_feature", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      eventName: " Report Exported ",
      featureKey: "reports_exported",
      name: "Reports exported",
      propertyFilters: [
        {
          property: "environment",
          operator: "equals",
          value: { type: "string", value: "production" },
        },
      ],
      requestId: expect.any(String),
    })
  })

  test("defaults omitted Feature filters to an empty array", async () => {
    const { default: createCmd } = await import("../../src/commands/features/create")

    await captureStdout(() =>
      createCmd.run!({
        args: {
          "source-key": "metric_source_v1_0123456789abcdef0123456789abcdef",
          "event-name": "report_exported",
          "feature-key": "reports_exported",
          name: "Reports exported",
          json: true,
        },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_create_feature", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      eventName: "report_exported",
      featureKey: "reports_exported",
      name: "Reports exported",
      propertyFilters: [],
      requestId: expect.any(String),
    })
  })

  test("archive previews with the opaque feature id and current revision, and archives nothing without a yes", async () => {
    mockCallTool.mockImplementationOnce(async () => featureArchivePreview)
    const { default: archiveCmd } = await import("../../src/commands/features/archive")

    await runExpectingError(
      () =>
        archiveCmd.run!({
          args: {
            id: "value_feature_v1_0123456789abcdef0123456789abcdef",
            revision: " value_feature_revision_v1_fedcba9876543210fedcba9876543210 ",
            json: true,
          },
        } as Parameters<NonNullable<typeof archiveCmd.run>>[0]),
      "confirmation_required",
    )

    expect(mockCallTool).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenCalledWith("outlit_archive_feature", {
      id: "value_feature_v1_0123456789abcdef0123456789abcdef",
      revision: "value_feature_revision_v1_fedcba9876543210fedcba9876543210",
      requestId: expect.any(String),
    })
  })

  test("archive --yes sends the preview token back to confirm", async () => {
    mockCallTool.mockImplementationOnce(async () => featureArchivePreview)
    mockCallTool.mockImplementationOnce(async () => ({
      archived: true,
      feature: {
        id: "value_feature_v1_0123456789abcdef0123456789abcdef",
        archivedAt: "2026-07-28T00:00:00.000Z",
      },
    }))
    const { default: archiveCmd } = await import("../../src/commands/features/archive")

    const result = await captureStdout(() =>
      archiveCmd.run!({
        args: {
          id: "value_feature_v1_0123456789abcdef0123456789abcdef",
          revision: "value_feature_revision_v1_fedcba9876543210fedcba9876543210",
          yes: true,
          json: true,
        },
      } as Parameters<NonNullable<typeof archiveCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledTimes(2)
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_archive_feature", {
      id: "value_feature_v1_0123456789abcdef0123456789abcdef",
      revision: "value_feature_revision_v1_fedcba9876543210fedcba9876543210",
      mode: "execute",
      previewToken: "preview_token_1",
      requestId: expect.any(String),
    })
    expect(result).toMatchObject({ archived: true })
  })

  test("rejects malformed filters and out-of-range windows before calling Core", async () => {
    const { default: createCmd } = await import("../../src/commands/features/create")
    const { default: workspaceCmd } = await import("../../src/commands/features/list")

    await runExpectingError(
      () =>
        createCmd.run!({
          args: {
            "source-key": "metric_source_v1_0123456789abcdef0123456789abcdef",
            "event-name": "report_exported",
            "feature-key": "reports_exported",
            name: "Reports exported",
            "property-filters": "not-json",
            json: true,
          },
        } as Parameters<NonNullable<typeof createCmd.run>>[0]),
      "invalid_input",
    )
    await runExpectingError(
      () =>
        workspaceCmd.run!({
          args: { weeks: "54", json: true },
        } as Parameters<NonNullable<typeof workspaceCmd.run>>[0]),
      "invalid_input",
    )

    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
