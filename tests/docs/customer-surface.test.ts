import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { timelineChannels } from "../../packages/tools/src/generated/contracts"

function readDoc(path: string): string {
  return readFileSync(path, "utf8")
}

const collaborationTools = [
  "outlit_assign_customer_owner",
  "outlit_grant_customer_access",
  "outlit_update_customer_access",
  "outlit_revoke_customer_access",
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
      "Comma-separated generic source type filter (`EMAIL`, `CALL`, `CALENDAR_EVENT`, `SUPPORT_TICKET`, `OPPORTUNITY`, `SLACK`). Case-insensitive. Aliases: `CRM`, `CRM_OPPORTUNITY`",
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
