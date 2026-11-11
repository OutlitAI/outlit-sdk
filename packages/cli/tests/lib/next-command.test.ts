import { describe, expect, test } from "bun:test"
import { moreLines, nextCommand } from "../../src/lib/next-command"

describe("nextCommand", () => {
  test.each([
    [
      "outlit_list_people",
      { customer: "cust_1", limit: 10 },
      "outlit people list --customer cust_1 --limit 10",
    ],
    [
      "outlit_get_timeline",
      { customer: "acme.com", cursor: "abc" },
      "outlit timeline get acme.com --cursor abc",
    ],
    [
      "outlit_get_fact",
      { id: "fact_1", part: { field: "evidence", cursor: "p2" } },
      "outlit facts get fact_1 --part evidence --cursor p2",
    ],
    [
      "outlit_get_customer",
      {
        customer: "cust_1",
        crmContacts: { connectionId: "conn_1", accountId: "001ABC", cursor: "p2" },
      },
      "outlit customers get cust_1 --crm-contacts conn_1:001ABC --cursor p2",
    ],
    [
      "outlit_get_customer",
      { customer: "Acme Corp", include: ["users", "crm"] },
      "outlit customers get 'Acme Corp' --include users,crm",
    ],
  ])("%s %j is a command", (tool, input, expected) => {
    expect(nextCommand(tool, input)).toBe(expected)
  })

  test("has no command for a tool without one, or an input that does not map to flags", () => {
    expect(nextCommand("outlit_query", { sql: "select 1" })).toBeUndefined()
    expect(
      nextCommand("outlit_list_facts", { customer: "c", filters: { status: ["active"] } }),
    ).toBe(undefined)
    expect(nextCommand("outlit_get_fact", {})).toBeUndefined()
    expect(nextCommand(undefined, {})).toBeUndefined()
  })

  test("quotes a value a shell would act on", () => {
    expect(nextCommand("outlit_get_timeline", { customer: "it's; rm -rf" })).toBe(
      "outlit timeline get 'it'\\''s; rm -rf'",
    )
  })
})

describe("moreLines", () => {
  test("names each part that holds only its first part, with the command or the gateway's sentence", () => {
    const lines = moreLines({
      customer: { id: "cust_1" },
      users: {
        status: "available",
        asOf: "2026-11-10T00:00:00Z",
        data: [],
        more: {
          omitted: 12,
          next: {
            instruction: "All 22 people",
            tool: "outlit_list_people",
            input: { customer: "cust_1", limit: 10 },
          },
        },
      },
      recentTimeline: {
        status: "available",
        asOf: "2026-11-10T00:00:00Z",
        data: [],
        more: {
          omitted: null,
          next: { instruction: "Older events are in the timeline", tool: "outlit_query" },
        },
      },
      crm: {
        status: "available",
        asOf: "2026-11-10T00:00:00Z",
        data: {
          accounts: [
            {
              accountId: "001ABC",
              omittedContactCount: 30,
              contactsNext: {
                instruction: "30 more contacts",
                tool: "outlit_get_customer",
                input: {
                  customer: "cust_1",
                  crmContacts: { connectionId: "conn_1", accountId: "001ABC" },
                },
              },
            },
          ],
        },
      },
    })

    expect(lines).toEqual([
      "users: 12 more: outlit people list --customer cust_1 --limit 10",
      "recentTimeline: More: Older events are in the timeline",
      "crm: 30 more contacts: outlit customers get cust_1 --crm-contacts conn_1:001ABC",
    ])
  })

  test("is empty for a result that holds everything", () => {
    expect(moreLines({ customer: { id: "c" }, users: { status: "available", data: [] } })).toEqual(
      [],
    )
    expect(moreLines(null)).toEqual([])
  })
})
