import { describe, expect, test } from "vitest"

import {
  collectionKeys,
  collectionOf,
  isCollectionTool,
  publicToolContracts,
  publicToolNames,
} from "../src/index.js"

const rowKeys = ["items", "facts", "events", "results", "rows"]

type OutputProperty = { type?: string }

function outputProperties(toolName: (typeof publicToolNames)[number]) {
  const schema = publicToolContracts[toolName].outputSchema as {
    properties?: Record<string, OutputProperty>
  }
  return schema.properties ?? {}
}

describe("collection keys", () => {
  test("name the array each list tool's output schema declares, and no other tool lists one", () => {
    const declared: Record<string, string> = {}
    for (const toolName of publicToolNames) {
      const arrays = Object.entries(outputProperties(toolName))
        .filter(([key, property]) => rowKeys.includes(key) && property.type === "array")
        .map(([key]) => key)
      expect(arrays.length, `${toolName} declares one row array`).toBeLessThanOrEqual(1)
      if (arrays[0]) declared[toolName] = arrays[0]
    }

    expect(collectionKeys).toEqual(declared)
  })

  test("only list tools that page declare a page, and every declared page has the paging fields", () => {
    for (const toolName of Object.keys(collectionKeys) as (keyof typeof collectionKeys)[]) {
      const page = outputProperties(toolName).page as
        | { properties?: Record<string, unknown> }
        | undefined
      // Search is the one list that does not page.
      if (toolName === "outlit_search_customer_context") {
        expect(page).toBeUndefined()
        continue
      }
      expect(Object.keys(page?.properties ?? {}), toolName).toEqual(
        expect.arrayContaining(["hasMore", "nextCursor"]),
      )
    }
  })
})

describe("collectionOf", () => {
  test("reads the rows, page and truncation from the tool's own key", () => {
    const page = { hasMore: true, nextCursor: "c1", total: 40 }
    const truncation = {
      truncated: true as const,
      reason: "byte_cap" as const,
      returned: 2,
      next: { instruction: "Page on." },
    }

    expect(collectionOf("outlit_list_facts", { facts: [{ id: "f1" }], page, truncation })).toEqual({
      key: "facts",
      items: [{ id: "f1" }],
      page,
      truncation,
    })
    expect(collectionOf("outlit_get_timeline", { events: [1, 2], page })?.items).toEqual([1, 2])
    expect(collectionOf("outlit_search_customer_context", { results: [{ a: 1 }] })).toEqual({
      key: "results",
      items: [{ a: 1 }],
    })
    expect(collectionOf("outlit_query", { rows: [[1]], columns: [] })?.key).toBe("rows")
  })

  test("gives an empty list for an output with no rows, and nothing for a tool that has no list", () => {
    expect(collectionOf("outlit_list_customers", {})).toEqual({ key: "items", items: [] })
    expect(collectionOf("outlit_list_customers", undefined)).toEqual({ key: "items", items: [] })
    expect(collectionOf("outlit_list_customers", { items: "nope" })?.items).toEqual([])
    expect(collectionOf("outlit_get_customer", { customer: {} })).toBeUndefined()
    expect(collectionOf("outlit_not_a_tool", { items: [] })).toBeUndefined()
    expect(isCollectionTool("outlit_list_people")).toBe(true)
    expect(isCollectionTool("outlit_get_fact")).toBe(false)
  })

  test("ignores a page or truncation that does not have the declared shape", () => {
    expect(
      collectionOf("outlit_list_people", {
        items: [],
        page: "x",
        truncation: { truncated: false },
      }),
    ).toEqual({ key: "items", items: [] })
  })
})
