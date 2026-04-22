import { readFileSync } from "node:fs"

import { describe, expect, test, vi } from "vitest"

import outlitGrowthAgents from "../extensions/outlit-growth-agents.js"

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

const commandScopes = [
  {
    commandName: "outlit-usage-decay-watchtower",
    scope: "paying customers over $500 MRR",
  },
  {
    commandName: "outlit-friction-to-churn",
    scope: "Atlas Assist",
  },
  {
    commandName: "outlit-activation-failure",
    scope: "trial accounts from the last 30 days",
  },
  {
    commandName: "outlit-expansion-readiness",
    scope: "starter-plan customers",
  },
]

const promptTemplates = ["friction-to-churn.md", "activation-failure.md", "expansion-readiness.md"]

describe("outlit growth agents notification workflow", () => {
  test("registers notification action tools by default", () => {
    const { registeredTools } = createPiHarness()

    expect(registeredTools.map((tool) => tool.name)).toContain("outlit_send_notification")
  })

  test.each(
    commandScopes,
  )("$commandName asks the agent to send one Slack notification with a JSON payload object", async ({
    commandName,
    scope,
  }) => {
    const { registeredCommands, sentMessages, waitForIdle } = createPiHarness()
    const command = registeredCommands.get(commandName)

    expect(command).toBeDefined()

    await command?.handler(scope, {
      ui: {
        notify: vi.fn(),
      },
      waitForIdle,
    })

    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0]).toContain("outlit_send_notification")
    expect(sentMessages[0]).toContain("call outlit_send_notification exactly once")
    expect(sentMessages[0]).toContain("payload must be a JSON-compatible object")
    expect(sentMessages[0]).toContain("Do not pass payload as a JSON string")
    expect(sentMessages[0]).toContain("candidateReviewSummary")
    expect(sentMessages[0]).toContain("rankedCustomers")
    expect(sentMessages[0]).toContain("excludedCandidates")
    expect(sentMessages[0]).toContain("dataQualityNotes")
    expect(sentMessages[0]).toContain("openQuestions")
  })

  test("usage-decay command notifies after deterministic evidence review", async () => {
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
    expect(sentMessages[0]).toContain("Deterministic pretriage note")
    expect(sentMessages[0]).toContain("call outlit_send_notification exactly once")
    expect(sentMessages[0]).toContain("If no live customer survives the evidence gate")
  })

  test("usage-decay command does not ask for a standalone draft JSON block", async () => {
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
    expect(sentMessages[0]).not.toContain("BEGIN_CHURN_WATCHTOWER_JSON")
    expect(sentMessages[0]).not.toContain("END_CHURN_WATCHTOWER_JSON")
    expect(sentMessages[0]).not.toContain("slackNotificationDraft")
    expect(sentMessages[0]).not.toContain("Do not call notification or action tools")
    expect(sentMessages[0]).toContain("candidateReviewSummary")
    expect(sentMessages[0]).toContain("rankedCustomers")
    expect(sentMessages[0]).toContain("excludedCandidates")
    expect(sentMessages[0]).toContain("Do not rename keys")
    expect(sentMessages[0]).toContain("notification payload")
    expect(sentMessages[0]).toContain('"mrrCents"')
    expect(sentMessages[0]).toContain("Already-churned accounts belong in excluded candidates")
    expect(sentMessages[0]).not.toContain("unless the user explicitly asks for postmortems")
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

  test("friction-to-churn command includes demo-specific investigation guidance", async () => {
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
    expect(sentMessages[0]).toContain("For a scoped account such as Atlas Assist")
    expect(sentMessages[0]).not.toContain("only when the user explicitly asks")
    expect(sentMessages[0]).not.toContain("Do not call notification or action tools")
  })

  test.each(
    promptTemplates,
  )("%s includes the default Slack notification payload contract", (fileName) => {
    const prompt = readFileSync(new URL(`../prompts/${fileName}`, import.meta.url), "utf8")

    expect(prompt).toContain("outlit_send_notification")
    expect(prompt).toContain("Call `outlit_send_notification` exactly once")
    expect(prompt).toContain("payload must be a JSON-compatible object")
    expect(prompt).toContain("Do not pass `payload` as a JSON string")
    expect(prompt).toContain("candidateReviewSummary")
    expect(prompt).toContain("rankedCustomers")
    expect(prompt).toContain("excludedCandidates")
    expect(prompt).toContain("dataQualityNotes")
    expect(prompt).toContain("openQuestions")
  })
})
