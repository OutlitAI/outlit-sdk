import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import {
  sourceTypes,
  toolFactCategories,
  toolFactTypes,
  toolTimelineChannels,
} from "../../packages/tools/src/generated/contracts"
import { piToolNames } from "../../packages/tools/src/toolsets"

function readDoc(path: string): string {
  return readFileSync(path, "utf8")
}

const collaborationTools = ["outlit_set_customer_owner", "outlit_set_customer_access"] as const

const contactTransitionFactTypes = [
  "contact_departure",
  "contact_position_change",
  "contact_disengagement",
] as const

describe("customer-surface documentation", () => {
  test("documents customer collaboration tools in API and MCP references", () => {
    const apiDocs = readDoc("docs/api-reference/tools.mdx")
    const mcpDocs = readDoc("docs/ai-integrations/mcp.mdx")

    for (const toolName of collaborationTools) {
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

    expect(piDocs).toContain("Attention reads, the toolset tools")
    expect(piDocs).toContain("customer ownership and access actions")
    expect(piReadme).toContain("customer ownership and access actions")
    expect(piExamples).toContain("createOutlitPiExtension, piToolNames")
    expect(piExamples).toContain("toolNames: piToolNames")
    expect(piExamples).not.toContain("allPublicToolNames")
    expect(readDoc("docs/api-reference/tools.mdx")).toContain("`piToolNames`")
  })

  test("documents contact-transition fact types without recommending category filters", () => {
    const cliDocs = readDoc("docs/cli/commands.mdx")
    const cliSource = readDoc("packages/cli/src/commands/facts/list.ts")
    const toolsDocs = readDoc("docs/api-reference/tools.mdx")
    const piReadme = readDoc("packages/pi/README.md")
    const piSkill = readDoc("packages/pi/skills/outlit/SKILL.md")
    const piExamples = readDoc("examples/pi-agents/README.md")
    const piExtension = readDoc("examples/pi-agents/extensions/outlit-growth-agents.ts")

    expect(toolFactCategories).toContain("relationship")
    for (const factType of contactTransitionFactTypes) {
      expect(toolFactTypes).toContain(factType)
      expect(cliDocs).toContain(`\`${factType}\``)
      expect(toolsDocs).toContain(`"${factType}"`)
      expect(piReadme).toContain(`\`${factType}\``)
      expect(piSkill).toContain(`\`${factType}\``)
      expect(piExamples).toContain(`\`${factType}\``)
      expect(piExtension).toContain(factType)
    }

    for (const category of toolFactCategories) {
      expect(cliDocs).toContain(`\`${category}\``)
    }

    for (const source of [cliDocs, cliSource]) {
      expect(source).not.toMatch(/--fact-categories relationship/i)
    }
    for (const source of [toolsDocs, piSkill, piExamples, piExtension]) {
      expect(source).not.toMatch(/categories: \["relationship"\]/i)
      expect(source).not.toMatch(/"categories": \["relationship"\]/i)
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
      "Comma-separated generic source type filter (`email`, `call`, `calendar_event`, `support_ticket`, `opportunity`, `slack`, `person_profile`, `invoice`, `crm_note`). Case-insensitive. Aliases: `CRM`, `CRM_OPPORTUNITY`",
    )
    expect(cliDocs).toContain("### List sources")
    expect(cliDocs).toContain("outlit sources list [flags]")
    expect(cliDocs).toContain(
      "List enumerated calls, emails, calendar events, support tickets, Slack conversations, or opportunities.",
    )
    expect(cliDocs).toContain(
      "outlit sources list --source-type slack --customer acme.com --limit 25 --json",
    )
    expect(cliDocs).toContain("the paginated `items` and `page` response")
    expect(cliDocs).toContain("`page.nextCursor`")
  })

  test("keeps every CLI source-type flag reference aligned with canonical source types", () => {
    const rows = readDoc("docs/cli/commands.mdx")
      .split("\n")
      .filter((line) => /^\| `--source-types?` \|/.test(line))

    expect(rows).toHaveLength(4)
    for (const row of rows) {
      for (const sourceType of sourceTypes) expect(row).toContain(`\`${sourceType}\``)
    }
  })

  test("leads CLI timeline documentation with lowercase channels and older names", () => {
    const cliDocs = readDoc("docs/cli/commands.mdx")

    for (const channel of toolTimelineChannels) expect(cliDocs).toContain(`\`${channel}\``)
    for (const [legacy, canonical] of [
      ["sdk", "product"],
      ["email", "communication"],
      ["slack", "communication"],
      ["call", "meeting"],
      ["calendar", "meeting"],
      ["internal", "system"],
    ]) {
      expect(cliDocs).toMatch(new RegExp(String.raw`\x60${legacy}\x60\s*→\s*\x60${canonical}\x60`))
    }
    expect(cliDocs).toContain('"channel": "communication"')
    expect(cliDocs).not.toContain('"channel": "SDK"')
    expect(cliDocs).not.toContain('"channel": "COMMUNICATION"')
  })
})
