// Embedded at build time (bun build / bun build --compile), so `outlit --skill`
// needs no network, auth, or files on disk. Source: docs/skill.md, synced from
// OutlitAI/skills by scripts/sync-outlit-skill.mjs.
import skillText from "../../../../docs/skill.md" with { type: "text" }

export const OUTLIT_SKILL: string = skillText

export const SKILL_STUB_NAME = "outlit"

/**
 * Installed by `outlit setup skills`. It only routes the agent to
 * `outlit --skill`, so the installed copy never drifts from the CLI.
 */
export const OUTLIT_SKILL_STUB = `---
name: ${SKILL_STUB_NAME}
description: Use when accessing Outlit customer intelligence through the \`outlit\` CLI, Outlit MCP tools, or @outlit/tools, including customer lookups, timelines, facts, source evidence, semantic search, revenue, churn, SQL analytics, identity, merge suggestions, setup, integrations, or troubleshooting agent access.
---

# Outlit

Outlit joins product activity, conversations, billing, support, CRM, and web signals into customer profiles, timelines, facts, and source evidence for agents.

Use it when the user needs real customer context for onboarding, adoption, retention, renewal, or expansion. Do not use it for generic customer-success advice that needs no workspace data.

The full, current instructions ship inside the CLI. Before using Outlit, run:

\`\`\`bash
outlit --skill
\`\`\`

Read its output and follow it. It needs no API key and no network, and it always matches the installed CLI version. If \`outlit\` is not installed, run \`npm install -g @outlit/cli\` first.
`
