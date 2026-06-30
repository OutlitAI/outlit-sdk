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

  test("runs agent lifecycle commands through platform action tools", async () => {
    const { default: enableCmd } = await import("../../src/commands/agents/enable")
    const { default: disableCmd } = await import("../../src/commands/agents/disable")
    const { default: renameCmd } = await import("../../src/commands/agents/rename")
    const { default: startRunCmd } = await import("../../src/commands/agents/runs/start")
    const { default: listRunsCmd } = await import("../../src/commands/agents/runs/list")
    const { default: getRunCmd } = await import("../../src/commands/agents/runs/get")

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
    await captureStdout(() =>
      startRunCmd.run!({
        args: { agentId: "agent_123", "client-request-id": "request_123", json: true },
      } as Parameters<NonNullable<typeof startRunCmd.run>>[0]),
    )
    await captureStdout(() =>
      listRunsCmd.run!({
        args: { agentId: "agent_123", limit: "5", cursor: "cursor_123", json: true },
      } as Parameters<NonNullable<typeof listRunsCmd.run>>[0]),
    )
    await captureStdout(() =>
      getRunCmd.run!({
        args: { agentId: "agent_123", runId: "run_123", json: true },
      } as Parameters<NonNullable<typeof getRunCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_agent_enable", { id: "agent_123" })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_agent_disable", { id: "agent_123" })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_agent_rename", {
      id: "agent_123",
      displayName: "Renamed",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(4, "outlit_agent_run_start", {
      agentId: "agent_123",
      clientRequestId: "request_123",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(5, "outlit_agent_run_list", {
      agentId: "agent_123",
      limit: 5,
      cursor: "cursor_123",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(6, "outlit_agent_run_get", {
      agentId: "agent_123",
      runId: "run_123",
    })
  })

  test("runs option discovery commands", async () => {
    const { default: automationOptionsCmd } = await import("../../src/commands/automations/options")
    const { default: signalOptionsCmd } = await import("../../src/commands/signals/options")
    const { default: destinationOptionsCmd } = await import(
      "../../src/commands/destinations/options"
    )

    await captureStdout(() =>
      automationOptionsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof automationOptionsCmd.run>>[0]),
    )
    await captureStdout(() =>
      signalOptionsCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof signalOptionsCmd.run>>[0]),
    )
    await captureStdout(() =>
      destinationOptionsCmd.run!({
        args: { search: "ops", limit: "10", json: true },
      } as Parameters<NonNullable<typeof destinationOptionsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_automation_options", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_signal_options", {})
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_destination_options", {
      search: "ops",
      limit: 10,
    })
  })

  test("runs automation run history commands", async () => {
    const { default: listRunsCmd } = await import("../../src/commands/automations/runs/list")
    const { default: getRunCmd } = await import("../../src/commands/automations/runs/get")

    await captureStdout(() =>
      listRunsCmd.run!({
        args: {
          automationId: "10000000-0000-4000-8000-000000000001",
          limit: "5",
          cursor: "cursor_123",
          json: true,
        },
      } as Parameters<NonNullable<typeof listRunsCmd.run>>[0]),
    )
    await captureStdout(() =>
      getRunCmd.run!({
        args: {
          automationId: "10000000-0000-4000-8000-000000000001",
          runId: "10000000-0000-4000-8000-000000000006",
          json: true,
        },
      } as Parameters<NonNullable<typeof getRunCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_automation_run_list", {
      automationId: "10000000-0000-4000-8000-000000000001",
      limit: 5,
      cursor: "cursor_123",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_automation_run_get", {
      automationId: "10000000-0000-4000-8000-000000000001",
      runId: "10000000-0000-4000-8000-000000000006",
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

  test("runs agent create and update commands", async () => {
    const { default: createCmd } = await import("../../src/commands/agents/create")
    const { default: updateCmd } = await import("../../src/commands/agents/update")

    await captureStdout(() =>
      createCmd.run!({
        args: {
          template: "churn",
          json: true,
        },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )
    await captureStdout(() =>
      createCmd.run!({
        args: {
          type: "custom",
          "display-name": "Renewal risk",
          instructions: "Find renewal risk.",
          "surface-criteria": "Surface risky renewals.",
          "action-keys": "send_slack_notification",
          json: true,
        },
      } as Parameters<NonNullable<typeof createCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateCmd.run!({
        args: { id: "agent_123", "display-name": "Renamed", json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateCmd.run!({
        args: { id: "agent_123", instructions: "New instructions", json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateCmd.run!({
        args: { id: "agent_123", "action-keys": "send_slack_notification,create_task", json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateCmd.run!({
        args: { id: "agent_123", "clear-action-keys": true, json: true },
      } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_agent_create", {
      type: "template",
      templateKey: "churn",
      mode: "draft",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_agent_create", {
      type: "custom",
      displayName: "Renewal risk",
      instructions: "Find renewal risk.",
      surfaceCriteria: "Surface risky renewals.",
      maxItemsToSurface: 10,
      actionKeys: ["send_slack_notification"],
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_agent_update", {
      id: "agent_123",
      displayName: "Renamed",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(4, "outlit_agent_update", {
      id: "agent_123",
      instructions: "New instructions",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(5, "outlit_agent_update", {
      id: "agent_123",
      actionKeys: ["send_slack_notification", "create_task"],
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(6, "outlit_agent_update", {
      id: "agent_123",
      actionKeys: [],
    })
  })

  test("requires explicit agent update input", async () => {
    const { default: updateCmd } = await import("../../src/commands/agents/update")

    await runExpectingError(
      () =>
        updateCmd.run!({
          args: { id: "agent_123", json: true },
        } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
      "missing_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects conflicting agent action update inputs", async () => {
    const { default: updateCmd } = await import("../../src/commands/agents/update")

    await runExpectingError(
      () =>
        updateCmd.run!({
          args: {
            id: "agent_123",
            "action-keys": "review_churn_followup",
            "clear-action-keys": true,
            json: true,
          },
        } as Parameters<NonNullable<typeof updateCmd.run>>[0]),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("runs JSON-backed automation and signal create/update commands", async () => {
    const { default: automationCreateCmd } = await import("../../src/commands/automations/create")
    const { default: automationUpdateCmd } = await import("../../src/commands/automations/update")
    const { default: signalCreateCmd } = await import("../../src/commands/signals/create")
    const { default: signalUpdateCmd } = await import("../../src/commands/signals/update")
    const automationId = "10000000-0000-4000-8000-000000000001"
    const bodyAutomationId = "10000000-0000-4000-8000-000000000099"
    const signalId = "10000000-0000-4000-8000-000000000002"
    const bodySignalId = "10000000-0000-4000-8000-000000000098"
    const automationBody = {
      agentId: "10000000-0000-4000-8000-000000000004",
      name: "Churn response",
      description: null,
      enabled: true,
      triggerType: "SIGNAL_OCCURRENCE",
      signalIds: [signalId],
      destinationIds: ["10000000-0000-4000-8000-000000000003"],
    }
    const signalBody = {
      kind: "EVENT_MATCH",
      name: "Workspace inactive",
      description: null,
      definition: {
        grain: "customer",
        subjectResolver: "event_customer",
        eventNames: ["workspace_inactive"],
        propertyConditions: [],
        conditionMode: "ALL",
      },
    }

    await captureStdout(() =>
      automationCreateCmd.run!({
        args: { data: JSON.stringify(automationBody), json: true },
      } as Parameters<NonNullable<typeof automationCreateCmd.run>>[0]),
    )
    await captureStdout(() =>
      automationUpdateCmd.run!({
        args: {
          id: automationId,
          data: JSON.stringify({ id: bodyAutomationId, ...automationBody }),
          json: true,
        },
      } as Parameters<NonNullable<typeof automationUpdateCmd.run>>[0]),
    )
    await captureStdout(() =>
      signalCreateCmd.run!({
        args: { data: JSON.stringify(signalBody), json: true },
      } as Parameters<NonNullable<typeof signalCreateCmd.run>>[0]),
    )
    await captureStdout(() =>
      signalUpdateCmd.run!({
        args: {
          id: signalId,
          data: JSON.stringify({ id: bodySignalId, ...signalBody }),
          json: true,
        },
      } as Parameters<NonNullable<typeof signalUpdateCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_automation_create", automationBody)
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_automation_update", {
      id: automationId,
      ...automationBody,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_signal_create", signalBody)
    expect(mockCallTool).toHaveBeenNthCalledWith(4, "outlit_signal_update", {
      id: signalId,
      ...signalBody,
    })
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
          json: true,
        },
      } as Parameters<NonNullable<typeof createDestinationCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateDestinationCmd.run!({
        args: {
          id: destinationId,
          type: "webhook",
          name: "Updated webhook",
          description: "Updated",
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_destination_create", {
      type: "SLACK_CHANNEL",
      channelId: "C0123456789",
      label: "#customer-ops",
      enabled: true,
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_destination_update", {
      id: destinationId,
      type: "WEBHOOK_ENDPOINT",
      name: "Updated webhook",
      description: "Updated",
    })
  })

  test("requires at least one destination update field", async () => {
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")

    await runExpectingError(
      () =>
        updateDestinationCmd.run!({
          args: {
            id: "10000000-0000-4000-8000-000000000003",
            type: "webhook",
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
            name: "Updated webhook",
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
            type: "email",
            name: "Updated webhook",
            enabled: true,
            json: true,
          },
        } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
      "invalid_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })
})
