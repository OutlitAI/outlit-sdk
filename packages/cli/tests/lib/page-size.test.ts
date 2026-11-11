import { describe, expect, test } from "bun:test"
import { publicToolContracts } from "@outlit/tools"
import { PAGE_SIZE, pageSizeArgs, SEARCH_PAGE_SIZE } from "../../src/args/pagination"
import searchCmd from "../../src/commands/search"

type LimitSchema = { default?: number; maximum?: number }

const pagedTools = [
  "outlit_list_customers",
  "outlit_list_customer_fields",
  "outlit_list_people",
  "outlit_list_members",
  "outlit_get_timeline",
  "outlit_list_facts",
  "outlit_list_sources",
  "outlit_list_destinations",
  "outlit_list_features",
  "outlit_list_tasks",
  "outlit_list_merge_suggestions",
  "outlit_search_customer_context",
] as const

describe("CLI page sizes follow the generated contracts", () => {
  test("every paged tool shares the default and maximum the CLI advertises", () => {
    for (const name of pagedTools) {
      const limit = publicToolContracts[name].inputSchema.properties.limit as LimitSchema
      const expected = name === "outlit_search_customer_context" ? SEARCH_PAGE_SIZE : PAGE_SIZE
      expect({ name, default: limit.default, max: limit.maximum }).toEqual({
        name,
        default: expected.default,
        max: expected.max,
      })
    }
  })

  test("the shared --limit flag states the contract default and maximum", () => {
    expect(pageSizeArgs.limit.default).toBe(String(PAGE_SIZE.default))
    expect(pageSizeArgs.limit.description).toContain(`1-${PAGE_SIZE.max}`)
    expect(pageSizeArgs.limit.description).toContain(`Default: ${PAGE_SIZE.default}`)
  })

  test("search --limit help states the contract default and maximum", () => {
    const args = searchCmd.args as { limit: { description: string } }
    expect(args.limit.description).toContain(`1-${SEARCH_PAGE_SIZE.max}`)
    expect(args.limit.description).toContain(`Default: ${SEARCH_PAGE_SIZE.default}`)
  })
})
