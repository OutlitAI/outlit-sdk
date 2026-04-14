import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { createOutlitPiExtension } from "@outlit/pi"

const CHURN_AGENT_SYSTEM_PROMPT = `
Outlit churn agent guidance:
- Use Outlit tools for customer health, activity, billing, facts, timeline, source, and context questions.
- Do not invent customer state. If customer evidence is missing or the API returns sparse data, say that directly.
- For churn reviews, prioritize recent product inactivity, negative sentiment, unresolved blockers, contract or pricing risk, support escalations, executive disengagement, and missing activation evidence.
- Tie recommendations to specific evidence from timeline events, facts, or source snippets whenever available.
`.trim()

const CHURN_REVIEW_PROMPT_PATTERN =
  /\b(churn|retention|renewal|account health|customer health|at-risk|at risk)\b/i

function buildChurnReviewPrompt(target: string | undefined): string {
  const scope = target?.trim()

  if (scope) {
    return `Run an Outlit churn review for ${scope}. Use the Outlit tools to gather customer context, timeline events, facts, and source evidence before writing the assessment.`
  }

  return "Run an Outlit churn review for the highest-risk paying or trialing customers. Start by finding likely at-risk customers, then gather customer context, timeline events, facts, and source evidence before writing the assessment."
}

function shouldApplyChurnGuidance(prompt: string): boolean {
  return CHURN_REVIEW_PROMPT_PATTERN.test(prompt)
}

export default function outlitChurnAgent(pi: ExtensionAPI) {
  createOutlitPiExtension()(pi)

  pi.registerCommand("outlit-churn-review", {
    description: "Review churn risk with Outlit customer intelligence",
    handler: async (args, ctx) => {
      const prompt = buildChurnReviewPrompt(args)
      ctx.ui.notify("Starting Outlit churn review", "info")
      pi.sendUserMessage(prompt)
    },
  })

  pi.on("before_agent_start", async (event) => {
    if (!shouldApplyChurnGuidance(event.prompt)) {
      return undefined
    }

    if (event.systemPrompt.includes(CHURN_AGENT_SYSTEM_PROMPT)) {
      return undefined
    }

    return {
      systemPrompt: `${event.systemPrompt}\n\n${CHURN_AGENT_SYSTEM_PROMPT}`,
    }
  })
}
