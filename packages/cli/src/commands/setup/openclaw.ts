import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { TICK, maskKey, requireCredential, writeConfigFile } from "../../lib/config"
import { isJsonMode, outputResult } from "../../lib/output"

export function getSkillDir(): string {
  const home = homedir()
  const clawdDir = join(home, "clawd")
  if (existsSync(clawdDir)) {
    return join(clawdDir, "skills", "outlit-intelligence")
  }
  return join(home, ".openclaw", "skills", "outlit-intelligence")
}

export function buildSkillContent(maskedKey: string): string {
  return `---
name: outlit-intelligence
description: Query customer data, revenue metrics, and analytics via the Outlit CLI.
metadata:
  openclaw:
    requires:
      bins: ["outlit"]
      env: ["OUTLIT_API_KEY"]
---

# Outlit Customer Intelligence

You have access to the \`outlit\` CLI for querying customer data and analytics.
The CLI outputs structured JSON automatically in non-TTY contexts.

## Authentication

Set the env var before running any command:

    export OUTLIT_API_KEY=${maskedKey}

## List customers

    outlit customers list --billing-status PAYING --no-activity-in 30d --order-by mrr_cents

## Get customer details

    outlit customers get acme.com --include users,revenue,recentTimeline

## Get customer activity timeline

    outlit customers timeline acme.com --channels EMAIL,SLACK --limit 50

## List users for a customer

    outlit users list --customer-id <uuid> --journey-stage ACTIVATED

## Search across customer context

    outlit search "budget concerns" --customer acme.com

## Get facts about a customer

    outlit facts acme.com --timeframe 90d

## Run custom SQL

    outlit sql "SELECT event_type, count(*) FROM events GROUP BY 1 ORDER BY 2 DESC LIMIT 10"

## Query with a file (for complex SQL)

    outlit sql --query-file /tmp/query.sql

## Discover table schemas

    outlit schema
    outlit schema events

## Rules
- Always parse the JSON response before reporting to the user
- Convert monetary values from cents to dollars (divide by 100)
- IDs are UUIDs (e.g., "a1b2c3d4-e5f6-...")
- Never show the raw API key to the user
- Use --query-file for complex SQL to avoid shell escaping issues
- All list responses include pagination.hasMore and pagination.nextCursor
`
}

export function configureSafe(key: string, json: boolean): boolean {
  const skillPath = join(getSkillDir(), "SKILL.md")
  try {
    writeConfigFile(skillPath, buildSkillContent(maskKey(key)), { json, label: "SKILL.md" })
    return true
  } catch {
    return false
  }
}

export default defineCommand({
  meta: {
    name: "openclaw",
    description: "Write Outlit intelligence skill to ~/clawd/skills/ for OpenClaw.",
  },
  args: { ...authArgs, ...outputArgs },
  run({ args }) {
    const json = !!args.json
    const { key } = requireCredential(args["api-key"], json)
    const skillPath = join(getSkillDir(), "SKILL.md")
    const content = buildSkillContent(maskKey(key))

    writeConfigFile(skillPath, content, { json, label: "SKILL.md" })

    if (isJsonMode(json)) {
      return outputResult({ success: true, path: skillPath, agent: "openclaw" })
    }

    console.log(
      `${TICK} Outlit skill written to ${skillPath}. OpenClaw will load it automatically.`,
    )
  },
})
