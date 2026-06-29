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

  test("runs agent create and focused update commands", async () => {
    const { default: createCustomCmd } = await import("../../src/commands/agents/create-custom")
    const { default: updateProfileCmd } = await import("../../src/commands/agents/update-profile")
    const { default: updateInstructionsCmd } = await import(
      "../../src/commands/agents/update-instructions"
    )
    const { default: updateActionsCmd } = await import("../../src/commands/agents/update-actions")

    await captureStdout(() =>
      createCustomCmd.run!({
        args: {
          "display-name": "Renewal risk",
          instructions: "Find renewal risk.",
          "surface-criteria": "Surface risky renewals.",
          "action-keys": "send_slack_notification",
          json: true,
        },
      } as Parameters<NonNullable<typeof createCustomCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateProfileCmd.run!({
        args: { id: "agent_123", "display-name": "Renamed", json: true },
      } as Parameters<NonNullable<typeof updateProfileCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateInstructionsCmd.run!({
        args: { id: "agent_123", instructions: "New instructions", json: true },
      } as Parameters<NonNullable<typeof updateInstructionsCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateActionsCmd.run!({
        args: { id: "agent_123", "action-keys": "send_slack_notification,create_task", json: true },
      } as Parameters<NonNullable<typeof updateActionsCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateActionsCmd.run!({
        args: { id: "agent_123", clear: true, json: true },
      } as Parameters<NonNullable<typeof updateActionsCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_agent_create_custom", {
      displayName: "Renewal risk",
      instructions: "Find renewal risk.",
      surfaceCriteria: "Surface risky renewals.",
      maxItemsToSurface: 10,
      actionKeys: ["send_slack_notification"],
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_agent_update_profile", {
      id: "agent_123",
      displayName: "Renamed",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_agent_update_instructions", {
      id: "agent_123",
      instructions: "New instructions",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(4, "outlit_agent_update_actions", {
      id: "agent_123",
      actionKeys: ["send_slack_notification", "create_task"],
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(5, "outlit_agent_update_actions", {
      id: "agent_123",
      actionKeys: [],
    })
  })

  test("requires explicit agent action update input", async () => {
    const { default: updateActionsCmd } = await import("../../src/commands/agents/update-actions")

    await runExpectingError(
      () =>
        updateActionsCmd.run!({
          args: { id: "agent_123", json: true },
        } as Parameters<NonNullable<typeof updateActionsCmd.run>>[0]),
      "missing_input",
    )
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("rejects conflicting agent action update inputs", async () => {
    const { default: updateActionsCmd } = await import("../../src/commands/agents/update-actions")

    await runExpectingError(
      () =>
        updateActionsCmd.run!({
          args: {
            id: "agent_123",
            "action-keys": "review_churn_followup",
            clear: true,
            json: true,
          },
        } as Parameters<NonNullable<typeof updateActionsCmd.run>>[0]),
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

  test("runs destination create webhook and update commands", async () => {
    const { default: createWebhookCmd } = await import(
      "../../src/commands/destinations/create-webhook"
    )
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")
    const destinationId = "10000000-0000-4000-8000-000000000003"

    await captureStdout(() =>
      createWebhookCmd.run!({
        args: {
          name: "Customer ops",
          url: "https://hooks.example.com/outlit",
          description: "Ops webhook",
          json: true,
        },
      } as Parameters<NonNullable<typeof createWebhookCmd.run>>[0]),
    )
    await captureStdout(() =>
      updateDestinationCmd.run!({
        args: {
          id: destinationId,
          type: "WEBHOOK_ENDPOINT",
          name: "Updated webhook",
          description: "Updated",
          disabled: true,
          json: true,
        },
      } as Parameters<NonNullable<typeof updateDestinationCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_destination_create_webhook", {
      type: "WEBHOOK_ENDPOINT",
      name: "Customer ops",
      description: "Ops webhook",
      enabled: true,
      url: "https://hooks.example.com/outlit",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_destination_update", {
      id: destinationId,
      type: "WEBHOOK_ENDPOINT",
      name: "Updated webhook",
      description: "Updated",
      enabled: false,
    })
  })

  test("requires explicit destination update lifecycle state", async () => {
    const { default: updateDestinationCmd } = await import("../../src/commands/destinations/update")

    await runExpectingError(
      () =>
        updateDestinationCmd.run!({
          args: {
            id: "10000000-0000-4000-8000-000000000003",
            type: "WEBHOOK_ENDPOINT",
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
            type: "WEBHOOK",
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
