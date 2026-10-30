import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { OutlitToolsApiError } from "@outlit/tools"
import {
  readCustomerSelector,
  requireCustomerSelector,
  resolveCustomerIdOrExit,
} from "../../src/args/customer"
import type { OutlitClient } from "../../src/lib/client"
import { ExitError, mockExitThrow, setNonInteractive, TEST_API_KEY } from "../helpers"

const acmeId = "10000000-0000-4000-8000-00000000000a"
const acmeEuId = "10000000-0000-4000-8000-00000000000b"
const betaId = "10000000-0000-4000-8000-00000000000c"

type Page = { items: unknown[]; pagination: { hasMore: boolean; nextCursor: string | null } }

function page(items: unknown[], nextCursor: string | null = null): Page {
  return { items, pagination: { hasMore: nextCursor !== null, nextCursor } }
}

function fakeClient(pages: Page[]) {
  const callTool = mock(async (_tool: string, _params: Record<string, unknown>) => {
    const next = pages.shift()
    if (!next) throw new Error("unexpected extra page request")
    return next
  })
  const client = { key: TEST_API_KEY, baseUrl: "https://app.outlit.ai", callTool }
  return { client: client as unknown as OutlitClient, callTool }
}

async function expectExit(run: () => unknown): Promise<Record<string, unknown>> {
  const exitSpy = mockExitThrow()
  const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
  let thrown: unknown
  try {
    await run()
  } catch (error) {
    thrown = error
  } finally {
    exitSpy.mockRestore()
  }
  const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
  stderrSpy.mockRestore()
  expect(thrown).toBeInstanceOf(ExitError)
  expect((thrown as ExitError).code).toBe(1)
  return JSON.parse(stderr) as Record<string, unknown>
}

describe("customer selector", () => {
  beforeEach(() => setNonInteractive())
  afterEach(() => mock.restore())

  test("reads the positional, --customer, or --customer-id", () => {
    expect(readCustomerSelector({ customerPositional: " acme.com " }, true)).toBe("acme.com")
    expect(readCustomerSelector({ customer: "acme.com" }, true)).toBe("acme.com")
    expect(readCustomerSelector({ "customer-id": acmeId }, true)).toBe(acmeId)
    expect(
      readCustomerSelector({ customerPositional: "acme.com", customer: "acme.com" }, true),
    ).toBe("acme.com")
    expect(readCustomerSelector({}, true)).toBeUndefined()
  })

  test.each([
    [{ customer: "" }, "--customer"],
    [{ customerPositional: "   " }, "<customer>"],
    [{ "customer-id": " ", customer: "acme.com" }, "--customer-id"],
  ])("rejects a blank customer instead of dropping the filter: %j", async (args, source) => {
    const error = await expectExit(() => readCustomerSelector(args, true))

    expect(error).toEqual({
      error: `${source} needs a customer domain, name, or ID`,
      code: "invalid_input",
    })
  })

  test("rejects two different customers", async () => {
    const error = await expectExit(() =>
      readCustomerSelector({ customerPositional: "acme.com", customer: "beta.com" }, true),
    )

    expect(error.code).toBe("invalid_input")
    expect(error.error).toBe("Give one customer; got <customer> acme.com and --customer beta.com")
  })

  test("requires a customer where the command needs one", async () => {
    const error = await expectExit(() =>
      requireCustomerSelector({}, "outlit customers timeline", true),
    )

    expect(error.code).toBe("missing_input")
    expect(error.error).toContain("outlit customers timeline --customer <domain|name|id>")
  })

  test("passes a UUID through without a lookup", async () => {
    const { client, callTool } = fakeClient([])

    expect(await resolveCustomerIdOrExit(client, acmeId.toUpperCase(), true)).toBe(
      acmeId.toUpperCase(),
    )
    expect(callTool).not.toHaveBeenCalled()
  })

  test("resolves a domain case-insensitively, ahead of name matches, without more pages", async () => {
    const { client, callTool } = fakeClient([
      page(
        [
          { id: acmeEuId, name: "acme.com", domain: "acme.eu" },
          { id: acmeId, name: "Acme", domain: "acme.com" },
        ],
        "cursor_2",
      ),
    ])

    expect(await resolveCustomerIdOrExit(client, "ACME.com", true)).toBe(acmeId)
    expect(callTool).toHaveBeenCalledWith("outlit_list_customers", {
      search: "ACME.com",
      limit: 100,
      orderBy: "name",
      orderDirection: "asc",
    })
    expect(callTool).toHaveBeenCalledTimes(1)
  })

  test("resolves an exact name on a later page", async () => {
    const { client, callTool } = fakeClient([
      page([{ id: acmeEuId, name: "Acme Europe", domain: "acme.eu" }], "cursor_2"),
      page([{ id: acmeId, name: "Acme", domain: "acme.com" }]),
    ])

    expect(await resolveCustomerIdOrExit(client, "acme", true)).toBe(acmeId)
    expect(callTool.mock.calls[1]?.[1]).toMatchObject({ cursor: "cursor_2" })
  })

  test("does not count a customer repeated across pages as a second match", async () => {
    const acme = { id: acmeId, name: "Acme", domain: "acme.com" }
    const { client } = fakeClient([page([acme], "cursor_2"), page([acme])])

    expect(await resolveCustomerIdOrExit(client, "Acme", true)).toBe(acmeId)
  })

  test("fails on an ambiguous name and lists the candidates", async () => {
    const { client } = fakeClient([
      page([
        { id: acmeId, name: "Acme", domain: "acme.com" },
        { id: acmeEuId, name: "acme", domain: "acme.eu" },
        { id: betaId, name: "Acme Beta", domain: "beta.com" },
      ]),
    ])

    const error = await expectExit(() => resolveCustomerIdOrExit(client, "Acme", true))

    expect(error.code).toBe("ambiguous_customer")
    expect(error.candidates).toEqual([
      { id: acmeId, name: "Acme", domain: "acme.com" },
      { id: acmeEuId, name: "acme", domain: "acme.eu" },
    ])
    expect(error.error).toContain("Pass the domain or ID instead.")
  })

  test("stops paging once two exact names make a non-domain ambiguous", async () => {
    const { client, callTool } = fakeClient([
      page(
        [
          { id: acmeId, name: "Acme", domain: "acme.com" },
          { id: acmeEuId, name: "Acme", domain: "acme.eu" },
        ],
        "cursor_2",
      ),
    ])

    const error = await expectExit(() => resolveCustomerIdOrExit(client, "acme", true))

    expect(error.code).toBe("ambiguous_customer")
    expect(error.error).toContain('"acme" matches at least 2 customers')
    expect(callTool).toHaveBeenCalledTimes(1)
  })

  test("does not accept a single name when the search stopped before the end", async () => {
    const pages = Array.from({ length: 10 }, (_, index) =>
      page(
        index === 0
          ? [{ id: acmeId, name: "Acme", domain: "acme.com" }]
          : [{ id: `10000000-0000-4000-8000-0000000001${index}0`, name: "Acme Co", domain: null }],
        `cursor_${index + 2}`,
      ),
    )
    const { client, callTool } = fakeClient(pages)

    const error = await expectExit(() => resolveCustomerIdOrExit(client, "acme", true))

    expect(error.code).toBe("ambiguous_customer")
    expect(error.error).toBe(
      'Too many customers match "acme" to confirm one by name. Pass the domain or ID instead.',
    )
    expect(callTool).toHaveBeenCalledTimes(10)
  })

  test("fails when nothing matches exactly, naming close matches", async () => {
    const { client } = fakeClient([page([{ id: acmeId, name: "Acme", domain: "acme.com" }])])

    const error = await expectExit(() => resolveCustomerIdOrExit(client, "acm", true))

    expect(error.code).toBe("customer_not_found")
    expect(error.error).toBe(
      `No customer has the domain or exact name "acm". Close matches: Acme (acme.com) ${acmeId}.`,
    )
  })

  test("keeps the gateway error envelope when the lookup fails", async () => {
    const callTool = mock(async () => {
      throw new OutlitToolsApiError(403, "", {
        code: "TOOL_CALL_FORBIDDEN",
        message: "Not allowed",
        retryable: false,
        requestId: "req_1",
      })
    })
    const client = { key: TEST_API_KEY, baseUrl: "", callTool } as unknown as OutlitClient

    const error = await expectExit(() => resolveCustomerIdOrExit(client, "acme.com", true))

    expect(error).toMatchObject({
      code: "TOOL_CALL_FORBIDDEN",
      message: "Not allowed",
      retryable: false,
      requestId: "req_1",
    })
  })
})
