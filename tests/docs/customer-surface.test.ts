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

  test("includes Slack in source-listing documentation", () => {
    const sourceDescription =
      "calls, emails, calendar events, support tickets, Slack messages, or opportunities"

    expect(readDoc("docs/api-reference/tools.mdx")).toContain(sourceDescription)
    expect(readDoc("docs/ai-integrations/mcp.mdx")).toContain(sourceDescription)
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
