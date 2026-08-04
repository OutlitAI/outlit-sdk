import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, expectTypeOf, test, vi } from "vitest"

import {
  allPublicToolNames,
  analyticalToolNames,
  apiKeyValidationTransport,
  type CustomerAnalyticsRow,
  type CustomerContextSearchInput,
  type CustomerDetail,
  type CustomerDetailResult,
  type CustomerListItem,
  type CustomerListResult,
  cliToolNames,
  createOutlitClient,
  customerSourceTypeInputs,
  customerSourceTypes,
  defaultToolNames,
  getPublicToolContract,
  isOutlitToolsApiError,
  normalizeCustomerSourceType,
  publicOpenApiTransports,
  resolveCustomerContextSearchInput,
  sdkConsumerContractHash,
  sqlToolNames,
  toolGatewayErrorCodes,
  toolGatewayErrorSchema,
} from "../src/index.js"

describe("toolsets", () => {
  test("matches the Core-owned public tool set and excludes retired notification sending", () => {
    expect(allPublicToolNames).toEqual([
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
      "outlit_list_destinations",
      "outlit_get_destination",
      "outlit_create_destination",
      "outlit_update_destination",
      "outlit_enable_destination",
      "outlit_disable_destination",
      "outlit_archive_destination",
      "outlit_list_integrations",
      "outlit_get_integration_capabilities",
      "outlit_begin_integration_setup",
      "outlit_get_integration_setup_status",
      "outlit_get_integration_sync_status",
      "outlit_get_customer_activation",
      "outlit_preview_customer_activation",
      "outlit_update_customer_activation",
      "outlit_get_workspace_settings",
      "outlit_update_workspace_settings",
    ])
    expect(allPublicToolNames).not.toContain("outlit_send_notification")
  })

  test("keeps SQL out of the default agent toolset", () => {
    expect(defaultToolNames).toContain("outlit_search_customer_context")
    expect(defaultToolNames).toContain("outlit_get_customer")
    expect(defaultToolNames).toContain("outlit_list_workspace_users")
    expect(defaultToolNames).toContain("outlit_list_sources")
    expect(defaultToolNames).toContain("outlit_begin_integration_setup")
    expect(defaultToolNames).not.toContain("outlit_send_notification")
    expect(defaultToolNames).not.toContain("outlit_query")
    expect(defaultToolNames).not.toContain("outlit_schema")
    expect(sqlToolNames).toEqual(["outlit_query", "outlit_schema"])
    expect(allPublicToolNames).toContain("outlit_query")
    expect(allPublicToolNames).toContain("outlit_list_workspace_users")
    expect(allPublicToolNames).not.toContain("outlit_send_notification")
    expect(cliToolNames).toEqual(allPublicToolNames)
  })

  test("exposes an analytical agent toolset with only default tools plus SQL", () => {
    expect(analyticalToolNames).toEqual(allPublicToolNames)
    expect(analyticalToolNames).not.toContain("outlit_send_notification")
    expect(analyticalToolNames).toContain("outlit_schema")
    expect(analyticalToolNames).toContain("outlit_query")
  })
})

describe("tool contracts", () => {
  test("keeps the Core-generated module data-only", () => {
    const generated = readFileSync(
      resolve(import.meta.dirname, "../src/generated/contracts.ts"),
      "utf8",
    )

    expect(generated).toContain("This file contains contract data only")
    expect(generated).not.toMatch(/\bfunction\b|\bclass\b|new Set|new Map/)
  })

  test("exports Core-owned transport and error contracts", () => {
    expect(publicOpenApiTransports).toHaveLength(3)
    expect(new Set(publicOpenApiTransports.map((transport) => transport.openApiPath)).size).toBe(3)
    expect(apiKeyValidationTransport).toEqual({
      method: "POST",
      path: "/api/validate-api-key",
    })
    expect(toolGatewayErrorSchema.properties.code.enum).toEqual(toolGatewayErrorCodes)
    expect(toolGatewayErrorSchema.required).toEqual(["code", "message", "retryable", "requestId"])
    expect(toolGatewayErrorSchema.additionalProperties).toBe(false)
  })

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
    const workspaceUsersContract = getPublicToolContract("outlit_list_workspace_users")
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

    const customerContract = getPublicToolContract("outlit_list_customers")
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
    expect(sdkConsumerContractHash).toBe(
      "378f57ef3007c6f0da4038591991bacc90bb9ddf855129ad782de31155075861",
    )

    const activatedSincePattern = customerProperties.activatedSince?.pattern
    expect(activatedSincePattern).toBeDefined()
    const activatedSinceRegex = new RegExp(activatedSincePattern ?? "")
    expect(activatedSinceRegex.test("2026-07-01T00:00:00.000Z")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01T00:00:00+05:30")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01")).toBe(false)
  })

  test("exposes fact type and category filters on facts listing", () => {
    const contract = getPublicToolContract("outlit_list_facts")
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
    const contract = getPublicToolContract("outlit_list_facts")
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

    const exactSourceContract = getPublicToolContract("outlit_get_source")
    const exactSourceProperties = exactSourceContract.inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >
    expect(exactSourceProperties.sourceType?.enum).toEqual(customerSourceTypeInputs)

    const searchContract = getPublicToolContract("outlit_search_customer_context")
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

  test("calls the generated gateway transport for every public capability", async () => {
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

    const result = await client.callTool("outlit_create_destination", { type: "WEBHOOK" })

    expect(result).toEqual({ items: [{ id: "cust_123" }] })
    expect(fetchMock).toHaveBeenCalledWith("https://example.outlit.test/api/tools/call", {
      method: "POST",
      headers: {
        Authorization: "Bearer ok_abcdefghijklmnopqrstuvwxyz123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "outlit_create_destination",
        input: { type: "WEBHOOK" },
      }),
    })
  })

  test("rejects unknown tool names at runtime", async () => {
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
    })

    // @ts-expect-error Runtime guard should still reject invalid external input.
    await expect(client.callTool("outlit_integration_setup_step", {})).rejects.toThrow(
      "Unknown public tool",
    )
  })

  test("preserves the stable gateway error envelope", async () => {
    const envelope = {
      code: "TOOL_CALL_FORBIDDEN",
      message: "Capability not authorized",
      retryable: false,
      requestId: "request_123",
      plan: "growth",
      feature: "public_tools",
      resetAt: null,
    }
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status: 403 })),
    })

    const error = await client.callTool("outlit_list_customers").catch((value: unknown) => value)
    expect(isOutlitToolsApiError(error)).toBe(true)
    if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
    expect(error.status).toBe(403)
    expect(error.envelope).toEqual(envelope)
  })

  test("rejects responses outside the generated gateway error schema", async () => {
    const invalidEnvelopes = [
      {
        code: "AUTHORIZATION_DENIED",
        message: "Legacy code",
        retryable: false,
        requestId: "request_legacy",
      },
      {
        code: "TOOL_CALL_FORBIDDEN",
        message: "Capability not authorized",
        retryable: false,
        requestId: "request_extra",
        internalDetail: "must not cross the gateway boundary",
      },
    ]
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidEnvelopes[0]), { status: 403 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidEnvelopes[1]), { status: 403 })),
    })

    for (const _invalidEnvelope of invalidEnvelopes) {
      const error = await client.callTool("outlit_list_customers").catch((value: unknown) => value)
      expect(isOutlitToolsApiError(error)).toBe(true)
      if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
      expect(error.envelope).toBeUndefined()
    }
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
