import { describe, expect, test, vi } from "vitest"

import outlitGrowthAgents from "../extensions/outlit-growth-agents.js"

const ENABLE_ACTION_TOOLS_ENV = "OUTLIT_PI_ENABLE_ACTION_TOOLS"

type RegisteredTool = {
  name?: string
}

type CommandHandler = (
  args: string | undefined,
  ctx: {
    ui: { notify: (message: string, level: "info") => void }
    waitForIdle?: () => Promise<void>
  },
) => Promise<void>

type CommandConfig = {
  description: string
  handler: CommandHandler
}

function createPiHarness({ enableActionTools = false }: { enableActionTools?: boolean } = {}) {
  const previousActionToolOptIn = process.env[ENABLE_ACTION_TOOLS_ENV]
  const registeredTools: RegisteredTool[] = []
  const registeredCommands = new Map<string, CommandConfig>()
  const sentMessages: string[] = []
  const waitForIdle = vi.fn(async () => {})

  if (enableActionTools) {
    process.env[ENABLE_ACTION_TOOLS_ENV] = "true"
  } else {
    delete process.env[ENABLE_ACTION_TOOLS_ENV]
  }

  try {
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
  } finally {
    if (previousActionToolOptIn === undefined) {
      delete process.env[ENABLE_ACTION_TOOLS_ENV]
    } else {
      process.env[ENABLE_ACTION_TOOLS_ENV] = previousActionToolOptIn
    }
  }

  return {
    registeredTools,
    registeredCommands,
    sentMessages,
    waitForIdle,
  }
}

describe("outlit growth agents notification guard", () => {
  test("does not register notification action tools by default", () => {
    const { registeredTools } = createPiHarness()

    expect(registeredTools.map((tool) => tool.name)).not.toContain("outlit_send_notification")
  })

  test("registers notification action tools with explicit opt-in", () => {
    const { registeredTools } = createPiHarness({ enableActionTools: true })

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
    expect(sentMessages[0]).toContain("Already-churned accounts belong in excluded candidates")
    expect(sentMessages[0]).not.toContain("unless the user explicitly asks for postmortems")
    const boundedJson = sentMessages[0].match(
      /BEGIN_CHURN_WATCHTOWER_JSON\s*([\s\S]*?)\s*END_CHURN_WATCHTOWER_JSON/,
    )

    expect(boundedJson?.[1]).toBeTruthy()
    const parsed = JSON.parse(boundedJson?.[1] ?? "{}")
    expect(parsed).toMatchObject({
      candidateReviewSummary: expect.any(Object),
      rankedCustomers: expect.any(Array),
      excludedCandidates: expect.any(Array),
      dataQualityNotes: expect.any(Array),
      openQuestions: expect.any(Array),
      slackNotificationDraft: expect.any(Object),
    })
    expect(parsed.slackNotificationDraft).not.toBeNull()
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

  test("usage-decay command works when older Pi APIs do not expose waitForIdle", async () => {
    const { registeredCommands } = createPiHarness()
    const command = registeredCommands.get("outlit-usage-decay-watchtower")

    expect(command).toBeDefined()

    await expect(
      command?.handler("customer org_39wh8g1uck5vdznhqtKVgHe4NUR", {
        ui: {
          notify: vi.fn(),
        },
      }),
    ).resolves.toBeUndefined()
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
    expect(sentMessages[0]).toContain("If outlit_send_notification is unavailable")
  })
})
