import { describe, expect, test, vi } from "vitest"

import {
  allCustomerToolNames,
  type CustomerContextSearchInput,
  createOutlitClient,
  defaultAgentToolNames,
  resolveCustomerContextSearchInput,
  sqlToolNames,
} from "../src/index.js"

describe("toolsets", () => {
  test("keeps SQL out of the default agent toolset", () => {
    expect(defaultAgentToolNames).toContain("outlit_search_customer_context")
    expect(defaultAgentToolNames).toContain("outlit_get_customer")
    expect(defaultAgentToolNames).not.toContain("outlit_query")
    expect(defaultAgentToolNames).not.toContain("outlit_schema")
    expect(sqlToolNames).toEqual(["outlit_schema", "outlit_query"])
    expect(allCustomerToolNames).toContain("outlit_query")
  })
})

describe("createOutlitClient", () => {
  test("calls the public tool endpoint with the selected customer tool", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [{ id: "cust_123" }] }), { status: 200 }),
      )

    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      baseUrl: "https://example.outlit.test",
      fetch: fetchMock,
    })

    const result = await client.callTool("outlit_list_customers", { limit: 10 })

    expect(result).toEqual({ items: [{ id: "cust_123" }] })
    expect(fetchMock).toHaveBeenCalledWith("https://example.outlit.test/api/tools/call", {
      method: "POST",
      headers: {
        Authorization: "Bearer ok_abcdefghijklmnopqrstuvwxyz123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "outlit_list_customers",
        input: { limit: 10 },
      }),
    })
  })

  test("rejects unknown tool names at runtime", async () => {
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
    })

    // @ts-expect-error Runtime guard should still reject invalid external input.
    await expect(client.callTool("outlit_connect_integration", {})).rejects.toThrow(
      "Unknown customer tool",
    )
  })
})

describe("resolveCustomerContextSearchInput", () => {
  test("allows a null customer filter to match the schema contract", () => {
    const input: CustomerContextSearchInput = {
      query: "churn risk",
      customer: null,
    }

    expect(input.customer).toBeNull()
  })

  test("rejects malformed date filters", () => {
    expect(
      resolveCustomerContextSearchInput({
        query: "churn risk",
        after: "not-a-date",
      }),
    ).toEqual({
      ok: false,
      message: "--after must be a valid ISO 8601 datetime",
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "churn risk",
        before: "still-not-a-date",
      }),
    ).toEqual({
      ok: false,
      message: "--before must be a valid ISO 8601 datetime",
    })
  })

  test("rejects date-only filters because the schema requires datetimes", () => {
    expect(
      resolveCustomerContextSearchInput({
        query: "churn risk",
        after: "2025-01-01",
      }),
    ).toEqual({
      ok: false,
      message: "--after must be a valid ISO 8601 datetime",
    })
  })
})
