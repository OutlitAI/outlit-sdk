import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import {
  actionToolNames,
  type CustomerToolName,
  createOutlitPiExtension,
  defaultAgentToolNames,
  sqlToolNames,
} from "@outlit/pi"

type AgentCommand = {
  name: string
  description: string
  notify: string
  prompt: (scope: string | undefined) => string
  trigger: RegExp
}

const SHARED_AGENT_SYSTEM_PROMPT = `
Outlit customer signal agent guidance:
- Use Outlit tools for customer discovery, customer details, timeline events, facts, source evidence, billing, product activity, and semantic customer context.
- Use outlit_schema and outlit_query for candidate discovery, cohorts, usage trends, revenue filters, activation gaps, and aggregate checks before deep account review.
- Use outlit_list_facts with factTypes for extracted customer-memory evidence when helpful, such as CHURN_RISK, EXPANSION, SENTIMENT, BUDGET, REQUIREMENTS, PRODUCT_USAGE, or CHAMPION_RISK.
- Do not assume behavioral/anomaly fact types exist for every customer. Treat usage-path and funnel facts as optional supporting evidence only.
- Use stable customer IDs or domains from SQL/search results for follow-up lookups. Avoid ambiguous display-name lookups when names share prefixes.
- Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
- Do not invent customer state. If customer evidence is missing, sparse, stale, or contradictory, say that directly.
- Separate adjacent signals: usage decay is not the same as support friction, support friction is not the same as activation failure, and activation failure is not the same as expansion readiness.
- For month-to-month and PLG accounts, churn can appear without renewal language. Look for usage decay, missing activation, unresolved blockers, payment problems, champion disappearance, and negative sentiment.
- Treat renewal negotiation, procurement delay, and pricing pushback as churn evidence only when they are paired with cancellation, downgrade, non-use, failed value realization, or explicit churn/downsell language.
- Do not let billing, renewal, legal, procurement, or generic spend-pressure evidence replace the specific evidence required by the selected agent.
- Tie every recommendation to specific evidence from customer records, timeline events, facts, search results, or source snippets whenever available.
`.trim()

// Keep the example compatible with the currently published @outlit/pi package.
// Newer versions export analyticalAgentToolNames directly.
const analyticalAgentToolNames = [
  ...defaultAgentToolNames,
  ...actionToolNames,
  ...sqlToolNames,
] as const satisfies readonly CustomerToolName[]

const COMMANDS: AgentCommand[] = [
  {
    name: "outlit-usage-decay-watchtower",
    description: "Find paying customers with usage decay that may lead to churn",
    notify: "Starting Outlit usage-decay churn review",
    prompt: (scope) =>
      buildPortfolioPrompt({
        title: "Usage Decay Churn Watchtower",
        scope,
        objective:
          "Find paying customers whose product behavior suggests they may cancel soon, even when there is no renewal date or explicit renewal conversation.",
        signals: [
          "product usage declining week over week or month over month",
          "fewer active users, seats, or core workflow events",
          "last meaningful activity becoming stale",
          "previously active champions or power users disappearing",
          "support or success conversations going quiet after an unresolved problem",
        ],
        avoid:
          "Do not rank a customer just because usage is low, or because a subscription was cancelled or paused. Explain why the usage pattern is a change from prior behavior, a missed activation path, or a risk for a paying account.",
      }),
    trigger:
      /\b(usage decay|usage decline|declining usage|inactive paying|paying inactive|usage churn|product inactivity|cancel anytime|month[-\s]to[-\s]month)\b/i,
  },
  {
    name: "outlit-friction-to-churn",
    description: "Find accounts where product or support friction is becoming churn risk",
    notify: "Starting Outlit friction-to-churn review",
    prompt: (scope) =>
      buildPortfolioPrompt({
        title: "Friction-to-Churn Agent",
        scope,
        objective:
          "Find customers where support issues, product blockers, failed integrations, bugs, or repeated complaints are turning into churn risk.",
        signals: [
          "repeated support complaints or unresolved issues",
          "failed setup, onboarding, or integration work",
          "negative sentiment tied to value realization",
          "missing features or bugs blocking core workflows",
          "continued complaints paired with declining usage, payment risk, or stakeholder disengagement",
        ],
        avoid:
          "Do not fill the ranking with generic churn-risk, renewal-risk, legal/procurement, spend-pressure, or usage-slowdown accounts. If you cannot find product, implementation, integration, bug, support, or blocker evidence, return fewer accounts and say friction evidence is insufficient.",
      }),
    trigger:
      /\b(friction[-\s]to[-\s]churn|product friction|support friction|support.*churn|repeated complaints?|customer complaints?|product blockers?|setup blockers?|integration blockers?|critical bugs?|bug reports?|failed integration|missing integration|support escalation|negative sentiment)\b/i,
  },
  {
    name: "outlit-activation-failure",
    description: "Find trials or new customers that are unlikely to activate or convert",
    notify: "Starting Outlit activation-failure review",
    prompt: (scope) =>
      buildPortfolioPrompt({
        title: "Activation Failure Agent",
        scope,
        objective:
          "Find trials, new customers, or recently converted accounts that are unlikely to activate, convert, or reach first value.",
        signals: [
          "signed up but did not reach the activation event or core workflow",
          "setup or onboarding stalled after initial interest",
          "trialing or unpaid customers with conversation activity but no product progress",
          "repeated implementation failures or missing integration blockers",
          "champion interest with no team adoption, payment method, or usage follow-through",
        ],
        avoid:
          "Do not classify explicit external, anonymous, test, or API-only pseudo-customers as activation failures unless they have a real customer identity and lifecycle evidence. Do not reject sandbox candidates solely for generic names/domains. Do not rank mature paying churn-risk accounts unless they are clearly still pre-activation or post-sale onboarding is incomplete.",
      }),
    trigger:
      /\b(activation failure|failed activation|activation (gap|issue|problem|risk)|trial conversion|trial (risk|ending|expiring)|onboarding stalled|failed onboarding|not activated|no payment method|missing payment)\b/i,
  },
  {
    name: "outlit-expansion-readiness",
    description: "Find customers ready to upgrade, expand seats, or buy more",
    notify: "Starting Outlit expansion-readiness review",
    prompt: (scope) =>
      buildPortfolioPrompt({
        title: "Expansion Readiness Agent",
        scope,
        objective:
          "Find customers likely to upgrade, expand seats, increase usage, or move to a higher plan.",
        signals: [
          "usage trending up or spreading across more users, teams, or workflows",
          "starter or small-plan customers behaving like power users",
          "plan limits, capacity constraints, or feature-gating pain",
          "positive sentiment, clear value realization, or champion advocacy",
          "questions about premium capabilities, additional seats, volume, or adjacent use cases",
        ],
        avoid:
          "Do not treat healthy usage, plan mismatch, high MRR, or broad feature usage alone as expansion readiness. Prioritize buying intent, capacity pressure, plan-limit pain, seat or team growth, premium-feature asks, or a clear next package to sell.",
      }),
    trigger:
      /\b(expansion readiness|expansion signal|upgrade intent|upgrade opportunity|ready to upgrade|upsell opportunity|seat growth|add(?:ing)? seats|more seats|seat limit|plan limit|power users?|usage trend up|buy more|higher plan|premium feature)\b/i,
  },
]

export default function outlitGrowthAgents(pi: ExtensionAPI) {
  createOutlitPiExtension({
    toolNames: analyticalAgentToolNames,
  })(pi)

  for (const command of COMMANDS) {
    pi.registerCommand(command.name, {
      description: command.description,
      handler: async (args, ctx) => {
        ctx.ui.notify(command.notify, "info")
        pi.sendUserMessage(command.prompt(args))
      },
    })
  }

  pi.on("before_agent_start", async (event) => {
    if (!shouldApplyOutlitSignalGuidance(event.prompt)) {
      return undefined
    }

    if (event.systemPrompt.includes(SHARED_AGENT_SYSTEM_PROMPT)) {
      return undefined
    }

    return {
      systemPrompt: `${event.systemPrompt}\n\n${SHARED_AGENT_SYSTEM_PROMPT}`,
    }
  })
}

function shouldApplyOutlitSignalGuidance(prompt: string): boolean {
  return COMMANDS.some((command) => command.trigger.test(prompt))
}

function buildPortfolioPrompt({
  title,
  scope,
  objective,
  signals,
  avoid,
}: {
  title: string
  scope: string | undefined
  objective: string
  signals: string[]
  avoid: string
}): string {
  const normalizedScope = scope?.trim()
  const scopeLine = normalizedScope
    ? `Scope: ${normalizedScope}.`
    : "Scope: scan the workspace and prioritize customers where the evidence is strongest."

  return `
Run the ${title} with Outlit customer intelligence.

${scopeLine}

Objective: ${objective}

Process:
1. Use outlit_schema when you need table names or fields, then use outlit_query for candidate discovery, cohorts, usage trends, revenue filters, activation gaps, or aggregate checks.
2. Gather customer, user, fact, timeline, search, billing, and source evidence for each candidate before ranking them. Use customer domains or IDs for follow-up lookups whenever possible.
3. Keep the search bounded: inspect the strongest 20-30 candidates, deep-dive no more than 10, then rank the best 5-8.
4. Prefer paying customers when the job is about churn or expansion. Include trials or new accounts for activation failure.
5. Return the strongest 5-8 accounts. If fewer accounts have enough evidence, return fewer and explain why.

Primary signals:
${signals.map((signal) => `- ${signal}`).join("\n")}

Guardrail: ${avoid}

For each customer, include the customer name, domain, lifecycle or billing context, signal strength, evidence, recommended action, confidence, and missing data.
`.trim()
}
