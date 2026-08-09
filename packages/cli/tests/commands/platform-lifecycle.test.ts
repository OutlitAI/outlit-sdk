import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const mockResult = { destination: { id: "destination_123" } }

const mockCallTool = mock(async (_toolName: string, _params: Record<string, unknown>) => mockResult)

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

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_create_destination", {
      type: "SLACK_CHANNEL",
      channelId: "C0123456789",
      label: "#customer-ops",
      enabled: true,
      isDefault: true,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_update_destination", {
      id: destinationId,
      type: "SLACK_CHANNEL",
      label: "#updated-ops",
      enabled: false,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_update_destination", {
      id: destinationId,
      type: "SLACK_CHANNEL",
      isDefault: true,
    })
  })

  test("runs Behavior Metric create with the canonical event-based payload", async () => {
    const { default: createBehaviorMetricCmd } = await import("../../src/commands/metrics/create")

    await captureStdout(() =>
      createBehaviorMetricCmd.run!({
        args: {
          source: "metric_source_v1_0123456789abcdef0123456789abcdef",
          event: "report_exported",
          key: "reports_exported",
          label: "Reports exported",
          "property-filters": JSON.stringify([
            {
              property: "environment",
              operator: "equals",
              value: { type: "string", value: "production" },
            },
          ]),
          json: true,
        },
      } as Parameters<NonNullable<typeof createBehaviorMetricCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_create_behavior_metric", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      eventName: "report_exported",
      behaviorKey: "reports_exported",
      label: "Reports exported",
      propertyFilters: [
        {
          property: "environment",
          operator: "equals",
          value: { type: "string", value: "production" },
        },
      ],
    })
  })

  test("defaults omitted Behavior Metric property filters to an empty array", async () => {
    const { default: createBehaviorMetricCmd } = await import("../../src/commands/metrics/create")

    await captureStdout(() =>
      createBehaviorMetricCmd.run!({
        args: {
          source: "metric_source_v1_0123456789abcdef0123456789abcdef",
          event: "report_exported",
          key: "reports_exported",
          label: "Reports exported",
          json: true,
        },
      } as Parameters<NonNullable<typeof createBehaviorMetricCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_create_behavior_metric", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      eventName: "report_exported",
      behaviorKey: "reports_exported",
      label: "Reports exported",
      propertyFilters: [],
    })
  })

  test("rejects invalid Behavior Metric property-filter JSON before calling the API", async () => {
    const { default: createBehaviorMetricCmd } = await import("../../src/commands/metrics/create")

    await runExpectingError(
      () =>
        createBehaviorMetricCmd.run!({
          args: {
            source: "metric_source_v1_0123456789abcdef0123456789abcdef",
            event: "report_exported",
            key: "reports_exported",
            label: "Reports exported",
            "property-filters": "not-json",
            json: true,
          },
        } as Parameters<NonNullable<typeof createBehaviorMetricCmd.run>>[0]),
      "invalid_input",
    )

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("runs Behavior Metric source and event discovery with caller-selected bounds", async () => {
    const { default: listBehaviorMetricSourcesCmd } = await import(
      "../../src/commands/metrics/sources"
    )
    const { default: listBehaviorMetricEventsCmd } = await import(
      "../../src/commands/metrics/events"
    )

    await captureStdout(() =>
      listBehaviorMetricSourcesCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listBehaviorMetricSourcesCmd.run>>[0]),
    )
    await captureStdout(() =>
      listBehaviorMetricEventsCmd.run!({
        args: {
          source: "metric_source_v1_0123456789abcdef0123456789abcdef",
          weeks: "4",
          limit: "20",
          json: true,
        },
      } as Parameters<NonNullable<typeof listBehaviorMetricEventsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_list_behavior_metric_sources", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_list_behavior_metric_events", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      weeks: 4,
      limit: 20,
    })
  })

  test("uses the canonical event discovery defaults", async () => {
    const { default: listBehaviorMetricEventsCmd } = await import(
      "../../src/commands/metrics/events"
    )

    await captureStdout(() =>
      listBehaviorMetricEventsCmd.run!({
        args: {
          source: "metric_source_v1_0123456789abcdef0123456789abcdef",
          json: true,
        },
      } as Parameters<NonNullable<typeof listBehaviorMetricEventsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_behavior_metric_events", {
      sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
      weeks: 12,
      limit: 100,
    })
  })

  test("rejects out-of-range Behavior Metric event discovery bounds before calling the API", async () => {
    const { default: listBehaviorMetricEventsCmd } = await import(
      "../../src/commands/metrics/events"
    )

    await runExpectingError(
      () =>
        listBehaviorMetricEventsCmd.run!({
          args: {
            source: "metric_source_v1_0123456789abcdef0123456789abcdef",
            weeks: "54",
            json: true,
          },
        } as Parameters<NonNullable<typeof listBehaviorMetricEventsCmd.run>>[0]),
      "invalid_input",
    )

    expect(mockCallTool).not.toHaveBeenCalled()
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
