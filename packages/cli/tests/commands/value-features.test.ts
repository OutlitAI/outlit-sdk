import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockResult = { ok: true }
const mockCallTool = mock(async (_toolName: string, _params: Record<string, unknown>) => mockResult)

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("Value Feature commands", () => {
  useTempEnv("value-feature-commands-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("reads the workspace with explicit source and bounded discovery inputs", async () => {
    const { default: workspaceCmd } = await import("../../src/commands/value-features/workspace")

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

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_value_feature_workspace", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      weeks: 4,
      candidateLimit: 20,
    })
  })

  test("lets Core auto-select a source while applying workspace defaults", async () => {
    const { default: workspaceCmd } = await import("../../src/commands/value-features/workspace")

    await captureStdout(() =>
      workspaceCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof workspaceCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_value_feature_workspace", {
      weeks: 12,
      candidateLimit: 100,
    })
  })

  test("creates one Value Feature while preserving the exact discovered event name", async () => {
    const { default: createCmd } = await import("../../src/commands/value-features/create")

    await captureStdout(() =>
      createCmd.run!({
        args: {
          source: " metric_source_v1_0123456789abcdef0123456789abcdef ",
          event: " Report Exported ",
          key: " reports_exported ",
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

    expect(mockCallTool).toHaveBeenCalledWith("outlit_create_value_feature", {
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
    })
  })

  test("defaults omitted Value Feature filters to an empty array", async () => {
    const { default: createCmd } = await import("../../src/commands/value-features/create")

    await captureStdout(() =>
      createCmd.run!({
        args: {
          source: "metric_source_v1_0123456789abcdef0123456789abcdef",
          event: "report_exported",
          key: "reports_exported",
          name: "Reports exported",
          json: true,
        },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_create_value_feature", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      eventName: "report_exported",
      featureKey: "reports_exported",
      name: "Reports exported",
      propertyFilters: [],
    })
  })

  test("archives only with the opaque feature id and current revision", async () => {
    const { default: archiveCmd } = await import("../../src/commands/value-features/archive")

    await captureStdout(() =>
      archiveCmd.run!({
        args: {
          id: "value_feature_v1_0123456789abcdef0123456789abcdef",
          revision: " value_feature_revision_v1_fedcba9876543210fedcba9876543210 ",
          json: true,
        },
      } as Parameters<NonNullable<typeof archiveCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_archive_value_feature", {
      id: "value_feature_v1_0123456789abcdef0123456789abcdef",
      revision: "value_feature_revision_v1_fedcba9876543210fedcba9876543210",
    })
  })

  test("reads customer feature usage with the canonical window", async () => {
    const { default: featureUsageCmd } = await import("../../src/commands/customers/feature-usage")

    await captureStdout(() =>
      featureUsageCmd.run!({
        args: { customer: " acme.com ", weeks: "6", json: true },
      } as Parameters<NonNullable<typeof featureUsageCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_customer_feature_usage", {
      customer: "acme.com",
      weeks: 6,
    })
  })

  test("rejects malformed filters and out-of-range windows before calling Core", async () => {
    const { default: createCmd } = await import("../../src/commands/value-features/create")
    const { default: workspaceCmd } = await import("../../src/commands/value-features/workspace")

    await runExpectingError(
      () =>
        createCmd.run!({
          args: {
            source: "metric_source_v1_0123456789abcdef0123456789abcdef",
            event: "report_exported",
            key: "reports_exported",
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
