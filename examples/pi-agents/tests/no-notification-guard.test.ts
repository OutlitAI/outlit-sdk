import { describe, expect, test, vi } from "vitest"

import outlitGrowthAgents from "../extensions/outlit-growth-agents.js"

type RegisteredTool = {
  name?: string
}

type CommandHandler = (
  args: string | undefined,
  ctx: {
    ui: { notify: (message: string, level: "info") => void }
    waitForIdle: () => Promise<void>
  },
) => Promise<void>

type CommandConfig = {
  description: string
  handler: CommandHandler
}

function createPiHarness() {
  const registeredTools: RegisteredTool[] = []
  const registeredCommands = new Map<string, CommandConfig>()
  const sentMessages: string[] = []
  const waitForIdle = vi.fn(async () => {})

  outlitGrowthAgents({
    registerTool: (tool) => {
      registeredTools.push(tool as RegisteredTool)
    },
    registerCommand: (name, config) => {
      registeredCommands.set(name, config)
    },
    on: vi.fn(),
    sendUserMessage: (prompt) => {
      sentMessages.push(prompt)
    },
  })

  return {
    registeredTools,
    registeredCommands,
    sentMessages,
    waitForIdle,
  }
}

describe("outlit growth agents notification guard", () => {
  test("registers notification action tool for explicitly requested Slack workflows", () => {
    const { registeredTools } = createPiHarness()

    expect(registeredTools.map((tool) => tool.name)).toContain("outlit_send_notification")
  })

  test("usage-decay command does not ask the agent to send notifications", async () => {
    const { registeredCommands, sentMessages, waitForIdle } = createPiHarness()
    const command = registeredCommands.get("outlit-usage-decay-watchtower")

    expect(command).toBeDefined()

    await command?.handler("customer org_39wh8g1uck5vdznhqtKVgHe4NUR", {
      ui: {
        notify: vi.fn(),
      },
      waitForIdle,
    })

    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0]).not.toContain("Notification action")
    expect(sentMessages[0]).not.toContain("outlit_send_notification")
  })

  test("usage-decay command asks for a stable Slack-ready JSON payload", async () => {
    const { registeredCommands, sentMessages, waitForIdle } = createPiHarness()
    const command = registeredCommands.get("outlit-usage-decay-watchtower")

    expect(command).toBeDefined()

    await command?.handler("paying customers", {
      ui: {
        notify: vi.fn(),
      },
      waitForIdle,
    })

    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0]).toContain("BEGIN_CHURN_WATCHTOWER_JSON")
    expect(sentMessages[0]).toContain("END_CHURN_WATCHTOWER_JSON")
    expect(sentMessages[0]).toContain("candidateReviewSummary")
    expect(sentMessages[0]).toContain("rankedCustomers")
    expect(sentMessages[0]).toContain("excludedCandidates")
    expect(sentMessages[0]).toContain("slackNotificationDraft")
    expect(sentMessages[0]).toContain("Do not rename keys")
    expect(sentMessages[0]).toContain("slackNotificationDraft must be an object")
    expect(sentMessages[0]).toContain('"mrrCents"')
    expect(sentMessages[0]).toMatch(/\n}\n- Use severity/)
  })

  test("usage-decay command waits for the Pi model turn it starts", async () => {
    const { registeredCommands, waitForIdle } = createPiHarness()
    const command = registeredCommands.get("outlit-usage-decay-watchtower")

    expect(command).toBeDefined()

    await command?.handler("customer org_39wh8g1uck5vdznhqtKVgHe4NUR", {
      ui: {
        notify: vi.fn(),
      },
      waitForIdle,
    })

    expect(waitForIdle).toHaveBeenCalledTimes(1)
  })

  test("friction-to-churn command includes demo and explicit notification guidance", async () => {
    const { registeredCommands, sentMessages, waitForIdle } = createPiHarness()
    const command = registeredCommands.get("outlit-friction-to-churn")

    expect(command).toBeDefined()

    await command?.handler(
      "Atlas Assist. Find actionable churn risk, cite source evidence, and notify Slack if it meets the threshold.",
      {
        ui: {
          notify: vi.fn(),
        },
        waitForIdle,
      },
    )

    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0]).toContain("manual workarounds")
    expect(sentMessages[0]).toContain("customer proof requests")
    expect(sentMessages[0]).toContain("outlit_send_notification")
    expect(sentMessages[0]).toContain("only when the user explicitly asks")
    expect(sentMessages[0]).toContain("Do not call notification or action tools")
  })
})
