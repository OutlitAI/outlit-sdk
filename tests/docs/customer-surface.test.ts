import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import {
  customerFactCategories,
  customerFactTypes,
  customerSourceTypes,
  publicToolNames,
  timelineChannels,
} from "../../packages/tools/src/generated/contracts"
import { piToolNames } from "../../packages/tools/src/toolsets"

function readDoc(path: string): string {
  return readFileSync(path, "utf8")
}

const collaborationTools = [
  "outlit_assign_customer_owner",
  "outlit_grant_customer_access",
  "outlit_update_customer_access",
  "outlit_revoke_customer_access",
] as const

const contactTransitionFactTypes = [
  "CONTACT_DEPARTURE",
  "CONTACT_POSITION_CHANGE",
  "CONTACT_DISENGAGEMENT",
] as const

const identityTools = [
  "outlit_get_customer_identity",
  "outlit_list_identity_merge_suggestions",
  "outlit_reject_identity_merge_suggestion",
  "outlit_merge_customers",
  "outlit_get_customer_merge_status",
] as const

const customerReadTools = [
  "outlit_get_customer_relationship",
  "outlit_list_attention_items",
  "outlit_get_attention_item",
] as const

describe("customer-surface documentation", () => {
  test("documents customer collaboration tools in API and MCP references", () => {
    const apiDocs = readDoc("docs/api-reference/tools.mdx")
    const mcpDocs = readDoc("docs/ai-integrations/mcp.mdx")

    for (const toolName of collaborationTools) {
      expect(apiDocs).toContain(`| \`${toolName}\` |`)
      expect(mcpDocs).toContain(`| \`${toolName}\` |`)
    }

    for (const toolName of customerReadTools) {
      expect(apiDocs).toContain(`| \`${toolName}\` |`)
      expect(mcpDocs).toContain(`| \`${toolName}\` |`)
    }
  })

  test("keeps the Pi policy and its public documentation aligned", () => {
    const piTools = new Set<string>(piToolNames)
    const piDocs = readDoc("docs/ai-integrations/pi.mdx")
    const piReadme = readDoc("packages/pi/README.md")
    const piExamples = readDoc("examples/pi-agents/README.md")

    for (const toolName of collaborationTools) expect(piTools.has(toolName)).toBe(true)

    expect(piDocs).toContain("customer relationship and Attention reads")
    expect(piDocs).toContain("customer ownership and access actions")
    expect(piReadme).toContain("customer ownership and access actions")
    expect(piExamples).toContain("createOutlitPiExtension, piToolNames")
    expect(piExamples).toContain("toolNames: piToolNames")
    expect(piExamples).not.toContain("allPublicToolNames")
    expect(readDoc("docs/api-reference/tools.mdx")).toContain("`piToolNames`")
  })

  test("documents public identity tools and their Pi policy", () => {
    const publicTools = new Set<string>(publicToolNames)
    const piTools = new Set<string>(piToolNames)
    const apiDocs = readDoc("docs/api-reference/tools.mdx")
    const mcpDocs = readDoc("docs/ai-integrations/mcp.mdx")

    for (const toolName of identityTools) {
      expect(publicTools.has(toolName)).toBe(true)
      expect(piTools.has(toolName)).toBe(true)
      expect(apiDocs).toContain(`| \`${toolName}\` |`)
      expect(mcpDocs).toContain(`| \`${toolName}\` |`)
    }

    for (const source of [
      mcpDocs,
      readDoc("docs/ai-integrations/pi.mdx"),
      readDoc("packages/pi/README.md"),
    ]) {
      expect(source).toContain("customer identity review and merge")
      expect(source).toContain("Customer merge execution has no supported undo")
      expect(source).toContain(
        "Execution retries must reuse the stable request ID and identical request inputs",
      )
    }
    expect(mcpDocs).not.toContain("identity-merge")
  })

  test("documents contact-transition fact types without recommending category filters", () => {
    const cliDocs = readDoc("docs/cli/commands.mdx")
    const cliSource = readDoc("packages/cli/src/commands/facts/list.ts")
    const toolsDocs = readDoc("docs/api-reference/tools.mdx")
    const piReadme = readDoc("packages/pi/README.md")
    const piSkill = readDoc("packages/pi/skills/outlit/SKILL.md")
    const piExamples = readDoc("examples/pi-agents/README.md")
    const piExtension = readDoc("examples/pi-agents/extensions/outlit-growth-agents.ts")

    expect(customerFactCategories).toContain("RELATIONSHIP")
    for (const factType of contactTransitionFactTypes) {
      expect(customerFactTypes).toContain(factType)
      expect(cliDocs).toContain(`\`${factType}\``)
      expect(toolsDocs).toContain(`"${factType}"`)
      expect(piReadme).toContain(`\`${factType}\``)
      expect(piSkill).toContain(`\`${factType}\``)
      expect(piExamples).toContain(`\`${factType}\``)
      expect(piExtension).toContain(factType)
    }

    for (const category of customerFactCategories) {
      expect(cliDocs).toContain(`\`${category}\``)
    }

    for (const source of [cliDocs, cliSource]) {
      expect(source).not.toContain("--fact-categories RELATIONSHIP")
    }
    for (const source of [toolsDocs, piSkill, piExamples, piExtension]) {
      expect(source).not.toContain('factCategories: ["RELATIONSHIP"]')
      expect(source).not.toContain('"factCategories": ["RELATIONSHIP"]')
    }
  })

  test("includes Slack conversations in source-listing and semantic-search documentation", () => {
    const mcpDocs = readDoc("docs/ai-integrations/mcp.mdx")
    const sourceDescription =
      "calls, emails, calendar events, support tickets, Slack conversations, or opportunities"
    const searchDescription =
      "customer facts, emails, calls, calendar events, support tickets, Slack conversations, and CRM opportunities"

    expect(readDoc("docs/api-reference/tools.mdx")).toContain(sourceDescription)
    expect(mcpDocs).toContain(sourceDescription)
    expect(mcpDocs).toContain(searchDescription)
    expect(readDoc("docs/api-reference/tools.mdx")).not.toContain("Slack messages")
    expect(mcpDocs).not.toContain("Slack messages")
  })

  test("documents CLI Slack search and deterministic source listing", () => {
    const cliDocs = readDoc("docs/cli/commands.mdx")

    expect(cliDocs).toContain(
      "Comma-separated generic source type filter (`EMAIL`, `CALL`, `CALENDAR_EVENT`, `SUPPORT_TICKET`, `OPPORTUNITY`, `SLACK`, `PERSON_PROFILE`). Case-insensitive. Aliases: `CRM`, `CRM_OPPORTUNITY`",
    )
    expect(cliDocs).toContain("### List Sources")
    expect(cliDocs).toContain("outlit sources list [flags]")
    expect(cliDocs).toContain(
      "List enumerated calls, emails, calendar events, support tickets, Slack conversations, or opportunities.",
    )
    expect(cliDocs).toContain(
      "outlit sources list --source-type SLACK --customer acme.com --limit 25 --json",
    )
    expect(cliDocs).toContain("the paginated `items` and `pagination` response")
    expect(cliDocs).toContain("`pagination.nextCursor`")
  })

  test("keeps every CLI source-type flag reference aligned with canonical source types", () => {
    const rows = readDoc("docs/cli/commands.mdx")
      .split("\n")
      .filter((line) => /^\| `--source-types?` \|/.test(line))

    expect(rows).toHaveLength(4)
    for (const row of rows) {
      for (const sourceType of customerSourceTypes) expect(row).toContain(`\`${sourceType}\``)
    }
  })

  test("leads CLI timeline documentation with canonical channels and aliases", () => {
    const cliDocs = readDoc("docs/cli/commands.mdx")

    for (const channel of timelineChannels) expect(cliDocs).toContain(`\`${channel}\``)
    for (const [legacy, canonical] of [
      ["SDK", "PRODUCT"],
      ["EMAIL", "COMMUNICATION"],
      ["SLACK", "COMMUNICATION"],
      ["CALL", "MEETING"],
      ["CALENDAR", "MEETING"],
      ["INTERNAL", "SYSTEM"],
    ]) {
      expect(cliDocs).toMatch(new RegExp(String.raw`\x60${legacy}\x60\s*→\s*\x60${canonical}\x60`))
    }
    expect(cliDocs).toContain('"channel": "PRODUCT"')
    expect(cliDocs).not.toContain('"channel": "SDK"')
  })
})
