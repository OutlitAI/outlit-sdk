import { describe, expect, expectTypeOf, test, vi } from "vitest"

import {
  allCustomerToolNames,
  analyticalAgentToolNames,
  type CustomerAnalyticsRow,
  type CustomerContextSearchInput,
  type CustomerDetail,
  type CustomerDetailResult,
  type CustomerListItem,
  type CustomerListResult,
  createOutlitClient,
  customerSourceTypeInputs,
  customerSourceTypes,
  customerToolContractHash,
  defaultAgentToolNames,
  getCustomerToolContract,
  normalizeCustomerSourceType,
  resolveCustomerContextSearchInput,
  sqlToolNames,
} from "../src/index.js"

describe("toolsets", () => {
  test("matches the Core-owned public tool set and excludes retired notification sending", () => {
    expect(allCustomerToolNames).toEqual([
      "outlit_list_customers",
      "outlit_list_users",
      "outlit_list_workspace_users",
      "outlit_get_customer",
      "outlit_get_timeline",
      "outlit_list_facts",
      "outlit_get_fact",
      "outlit_get_source",
      "outlit_list_sources",
      "outlit_search_customer_context",
      "outlit_query",
      "outlit_schema",
    ])
    expect(allCustomerToolNames).not.toContain("outlit_send_notification")
  })

  test("keeps SQL out of the default agent toolset", () => {
    expect(defaultAgentToolNames).toContain("outlit_search_customer_context")
    expect(defaultAgentToolNames).toContain("outlit_get_customer")
    expect(defaultAgentToolNames).toContain("outlit_list_workspace_users")
    expect(defaultAgentToolNames).toContain("outlit_list_sources")
    expect(defaultAgentToolNames).not.toContain("outlit_send_notification")
    expect(defaultAgentToolNames).not.toContain("outlit_query")
    expect(defaultAgentToolNames).not.toContain("outlit_schema")
    expect(sqlToolNames).toEqual(["outlit_schema", "outlit_query"])
    expect(allCustomerToolNames).toContain("outlit_query")
    expect(allCustomerToolNames).toContain("outlit_list_workspace_users")
    expect(allCustomerToolNames).not.toContain("outlit_send_notification")
  })

  test("exposes an analytical agent toolset with only default tools plus SQL", () => {
    expect(analyticalAgentToolNames).toEqual(allCustomerToolNames)
    expect(analyticalAgentToolNames).not.toContain("outlit_send_notification")
    expect(analyticalAgentToolNames).toContain("outlit_schema")
    expect(analyticalAgentToolNames).toContain("outlit_query")
    expect(allCustomerToolNames).not.toContain("outlit_send_notification")
    expect(allCustomerToolNames).toContain("outlit_schema")
    expect(allCustomerToolNames).toContain("outlit_query")
  })
})

describe("tool contracts", () => {
  test("types nullable company activation on customer and analytics results", () => {
    const listItem: CustomerListItem = {
      id: "customer_1",
      name: "Acme",
      domain: "acme.com",
      activatedAt: null,
    }
    const detail: CustomerDetailResult = {
      customer: {
        id: "customer_1",
        name: "Acme",
        domain: "acme.com",
        activatedAt: "2026-07-28T20:00:00.000Z",
      },
    }
    const analyticsRow: CustomerAnalyticsRow = {
      activated_at: null,
    }

    expect(listItem.activatedAt).toBeNull()
    expect(detail.customer.activatedAt).toBe("2026-07-28T20:00:00.000Z")
    expect(analyticsRow.activated_at).toBeNull()
  })

  test("infers activatedAt on typed customer list and get client results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [],
            pagination: { hasMore: false, nextCursor: null },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            customer: {
              id: "customer_1",
              name: "Acme",
              domain: "acme.com",
              activatedAt: null,
            },
          }),
          { status: 200 },
        ),
      )
    const client = createOutlitClient({
      apiKey: "ok_test",
      fetch: fetchMock,
    })

    const listResult = await client.callTool("outlit_list_customers")
    const detailResult = await client.callTool("outlit_get_customer", {
      customer: "acme.com",
    })

    expectTypeOf(listResult).toEqualTypeOf<CustomerListResult>()
    expectTypeOf(detailResult).toEqualTypeOf<CustomerDetailResult>()
    expectTypeOf(detailResult.customer).toEqualTypeOf<CustomerDetail>()
  })

  test("exposes workspace users and customer owner filters", () => {
    const workspaceUsersContract = getCustomerToolContract("outlit_list_workspace_users")
    const workspaceProperties = workspaceUsersContract.inputSchema.properties as Record<
      string,
      { type?: string; enum?: string[] }
    >

    expect(workspaceProperties.search).toEqual(
      expect.objectContaining({
        type: "string",
      }),
    )
    expect(workspaceProperties.hasOwnedCustomers).toEqual(
      expect.objectContaining({
        type: "boolean",
      }),
    )
    expect(workspaceProperties.orderBy?.enum).toEqual(["name", "email", "owned_customer_count"])

    const customerContract = getCustomerToolContract("outlit_list_customers")
    const customerProperties = customerContract.inputSchema.properties as Record<
      string,
      { type?: string; description?: string; format?: string; pattern?: string }
    >

    expect(customerProperties.ownerId).toEqual(expect.objectContaining({ type: "string" }))
    expect(customerProperties.ownerEmail).toEqual(expect.objectContaining({ type: "string" }))
    expect(customerProperties.hasOwner).toEqual(expect.objectContaining({ type: "boolean" }))
    expect(customerProperties.activatedSince).toEqual(
      expect.objectContaining({
        type: "string",
        format: "date-time",
        description: "Filter customers activated at or after this ISO-8601 datetime",
      }),
    )
    expect(customerToolContractHash).toBe(
      "b9ca81d1ec676dfbfa2ac72f8ef69946355504298b283050d7c161d06b9923cb",
    )

    const activatedSincePattern = customerProperties.activatedSince?.pattern
    expect(activatedSincePattern).toBeDefined()
    const activatedSinceRegex = new RegExp(activatedSincePattern ?? "")
    expect(activatedSinceRegex.test("2026-07-01T00:00:00.000Z")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01T00:00:00+05:30")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01")).toBe(false)
  })

  test("exposes fact type and category filters on facts listing", () => {
    const contract = getCustomerToolContract("outlit_list_facts")
    const properties = contract.inputSchema.properties as Record<string, unknown>

    expect(properties.factTypes).toEqual(
      expect.objectContaining({
        type: "array",
        items: expect.objectContaining({
          enum: expect.arrayContaining(["CHURN_RISK", "EXPANSION", "CHAMPION_RISK"]),
        }),
      }),
    )
    expect(properties.factCategories).toEqual(
      expect.objectContaining({
        type: "array",
        items: expect.objectContaining({
          enum: ["MEMORY", "CUSTOM"],
        }),
      }),
    )
  })

  test("keeps anomaly detector filters out of the facts listing schema", () => {
    const contract = getCustomerToolContract("outlit_list_facts")
    const properties = contract.inputSchema.properties as Record<
      string,
      { items?: { enum?: string[] } }
    >

    expect(properties.factTypes?.items?.enum).not.toContain("CORE_ACTION_DECAY")
    expect(properties.factTypes?.items?.enum).not.toContain("ACTIVATION_RATE_DROP")
    expect(properties.factTypes?.items?.enum).not.toContain("CHAMPION_AT_RISK")
    expect(properties.factCategories?.items?.enum).not.toContain("CHURN")
    expect(properties.factCategories?.items?.enum).not.toContain("JOURNEY")
  })

  test("exposes canonical source types with CRM aliases for inputs", () => {
    expect(customerSourceTypes).toEqual([
      "EMAIL",
      "CALL",
      "CALENDAR_EVENT",
      "SUPPORT_TICKET",
      "OPPORTUNITY",
      "SLACK",
    ])
    expect(customerSourceTypeInputs).toEqual([
      "EMAIL",
      "CALL",
      "CALENDAR_EVENT",
      "SUPPORT_TICKET",
      "OPPORTUNITY",
      "SLACK",
      "CRM",
      "CRM_OPPORTUNITY",
    ])
    expect(normalizeCustomerSourceType("CRM")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType("CRM_OPPORTUNITY")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType("crm")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType(" crm_opportunity ")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType(" opportunity ")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType("ZENDESK_TICKET")).toBeNull()
    expect(normalizeCustomerSourceType("toString")).toBeNull()
    expect(normalizeCustomerSourceType("constructor")).toBeNull()
    expect(normalizeCustomerSourceType("__proto__")).toBeNull()

    const exactSourceContract = getCustomerToolContract("outlit_get_source")
    const exactSourceProperties = exactSourceContract.inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >
    expect(exactSourceProperties.sourceType?.enum).toEqual(customerSourceTypeInputs)

    const searchContract = getCustomerToolContract("outlit_search_customer_context")
    const searchProperties = searchContract.inputSchema.properties as Record<
      string,
      { items?: { enum?: string[] } }
    >
    expect(searchProperties.sourceTypes?.items?.enum).toEqual(customerSourceTypeInputs)
  })
})

describe("createOutlitClient", () => {
  test("defaults to the hosted Outlit tool endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))

    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: fetchMock,
    })

    await client.callTool("outlit_list_customers", {})

    expect(client.baseUrl).toBe("https://app.outlit.ai")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.outlit.ai/api/tools/call",
      expect.any(Object),
    )
  })

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

  test("normalizes source types and CRM aliases in search input", () => {
    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: ["slack"],
      }),
    ).toEqual({
      ok: true,
      request: {
        query: "renewal",
        customer: undefined,
        topK: undefined,
        after: undefined,
        before: undefined,
        sourceTypes: ["SLACK"],
      },
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: ["CALL", "CRM"],
      }),
    ).toEqual({
      ok: true,
      request: {
        query: "renewal",
        customer: undefined,
        topK: undefined,
        after: undefined,
        before: undefined,
        sourceTypes: ["CALL", "OPPORTUNITY"],
      },
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: [" call ", "crm_opportunity", "opportunity"],
      }),
    ).toEqual({
      ok: true,
      request: {
        query: "renewal",
        customer: undefined,
        topK: undefined,
        after: undefined,
        before: undefined,
        sourceTypes: ["CALL", "OPPORTUNITY"],
      },
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: ["ZENDESK_TICKET"],
      }),
    ).toEqual({
      ok: false,
      message:
        "Unknown source types: ZENDESK_TICKET. Allowed: EMAIL, CALL, CALENDAR_EVENT, SUPPORT_TICKET, OPPORTUNITY, SLACK, CRM, CRM_OPPORTUNITY",
    })
  })
})
