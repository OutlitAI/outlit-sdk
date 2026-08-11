import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, expectTypeOf, test, vi } from "vitest"

import {
  allPublicToolNames,
  analyticalToolNames,
  apiKeyGrants,
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
  matchesGeneratedJsonSchema,
  normalizeCustomerSourceType,
  piToolNames,
  publicOpenApiTransports,
  resolveCustomerContextSearchInput,
  sdkConsumerContractHash,
  sqlToolNames,
  toolGatewayErrorCodes,
  toolGatewayErrorSchema,
} from "../src/index.js"

describe("matchesGeneratedJsonSchema", () => {
  test("accepts maxLength and maxItems boundaries and rejects values above them", () => {
    expect(matchesGeneratedJsonSchema("abc", { type: "string", maxLength: 3 })).toBe(true)
    expect(matchesGeneratedJsonSchema("abcd", { type: "string", maxLength: 3 })).toBe(false)
    expect(matchesGeneratedJsonSchema([1, 2], { type: "array", maxItems: 2 })).toBe(true)
    expect(matchesGeneratedJsonSchema([1, 2, 3], { type: "array", maxItems: 2 })).toBe(false)
  })

  test("accepts numeric boundaries and rejects values outside minimum and maximum", () => {
    const schema = { type: "number", minimum: 1, maximum: 3 }

    expect(matchesGeneratedJsonSchema(1, schema)).toBe(true)
    expect(matchesGeneratedJsonSchema(3, schema)).toBe(true)
    expect(matchesGeneratedJsonSchema(0.99, schema)).toBe(false)
    expect(matchesGeneratedJsonSchema(3.01, schema)).toBe(false)
  })

  test("accepts safe integer boundaries and rejects unsafe integers", () => {
    const schema = { type: "integer" }

    expect(matchesGeneratedJsonSchema(Number.MAX_SAFE_INTEGER, schema)).toBe(true)
    expect(matchesGeneratedJsonSchema(Number.MIN_SAFE_INTEGER, schema)).toBe(true)
    expect(matchesGeneratedJsonSchema(Number.MAX_SAFE_INTEGER + 1, schema)).toBe(false)
    expect(matchesGeneratedJsonSchema(Number.MIN_SAFE_INTEGER - 1, schema)).toBe(false)
  })
})

describe("toolsets", () => {
  test("matches the Core-owned public tool set, including customer collaboration", () => {
    expect(allPublicToolNames).toEqual([
      "outlit_list_customers",
      "outlit_list_users",
      "outlit_list_workspace_users",
      "outlit_get_customer",
      "outlit_assign_customer_owner",
      "outlit_grant_customer_access",
      "outlit_update_customer_access",
      "outlit_revoke_customer_access",
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
      "outlit_get_integration_capabilities",
      "outlit_begin_integration_setup",
      "outlit_get_integration_setup_status",
      "outlit_get_integration_status",
      "outlit_setup_integration",
      "outlit_get_customer_activation",
      "outlit_preview_customer_activation",
      "outlit_update_customer_activation",
      "outlit_get_workspace_settings",
      "outlit_update_workspace_settings",
      "outlit_list_behavior_metric_sources",
      "outlit_list_behavior_metric_events",
      "outlit_create_behavior_metric",
    ])
    expect(allPublicToolNames).toHaveLength(36)
    expect(allPublicToolNames).not.toContain("outlit_send_notification")
    expect(allPublicToolNames).not.toContain("outlit_submit_agent_output")
  })

  test("keeps the default agent toolset to the nine read-only intelligence tools", () => {
    expect(defaultToolNames).toEqual([
      "outlit_list_customers",
      "outlit_list_users",
      "outlit_get_customer",
      "outlit_get_timeline",
      "outlit_list_facts",
      "outlit_get_fact",
      "outlit_get_source",
      "outlit_list_sources",
      "outlit_search_customer_context",
    ])
    expect(sqlToolNames).toEqual(["outlit_query", "outlit_schema"])
    expect(piToolNames).toEqual(
      allPublicToolNames.filter(
        (name) =>
          name !== "outlit_list_behavior_metric_sources" &&
          name !== "outlit_list_behavior_metric_events" &&
          name !== "outlit_create_behavior_metric",
      ),
    )
    expect(cliToolNames).toEqual(allPublicToolNames)
  })

  test("exposes an analytical agent toolset with only default tools plus SQL", () => {
    expect(analyticalToolNames).toEqual([...defaultToolNames, "outlit_query", "outlit_schema"])
  })
})

describe("tool contracts", () => {
  test("keeps the Core-generated module data-only", () => {
    const generated = readFileSync(
      resolve(import.meta.dirname, "../src/generated/contracts.ts"),
      "utf8",
    )

    expect(generated).toContain("This file contains contract data only")
    expect(generated).not.toMatch(
      /\b(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$]|\b(?:export\s+)?class\s+[A-Za-z_$]|new\s+(?:Set|Map)\s*\(/,
    )
  })

  test("exports Core-owned transport and error contracts", () => {
    expect(publicOpenApiTransports).toHaveLength(3)
    expect(new Set(publicOpenApiTransports.map((transport) => transport.openApiPath)).size).toBe(3)
    expect(apiKeyValidationTransport).toEqual({
      method: "POST",
      path: "/api/validate-api-key",
      responseStatuses: { success: 200, invalid: 401, unavailable: 503 },
      publicResponseStatuses: [200, 401, 503],
    })
    expect(apiKeyGrants).not.toContain("agents:read")
    expect(apiKeyGrants).not.toContain("agents:write")
    expect(apiKeyGrants).toContain("behavior_metrics:manage")
    expect(toolGatewayErrorSchema.properties.code.enum).toEqual(toolGatewayErrorCodes)
    expect(toolGatewayErrorSchema.required).toEqual(["code", "message", "retryable", "requestId"])
    expect(toolGatewayErrorSchema.additionalProperties).toBe(false)
  })

  test("types nullable company activation on customer and analytics results", () => {
    const analyticsRow: CustomerAnalyticsRow = {
      activated_at: null,
    }

    expectTypeOf<CustomerListItem["activatedAt"]>().toEqualTypeOf<string | null>()
    expectTypeOf<CustomerDetail["activatedAt"]>().toEqualTypeOf<string | null>()
    expect(analyticsRow.activated_at).toBeNull()
  })

  test("projects generated Behavior Metric discovery and creation capabilities into public catalogues", () => {
    const sourcesContract = getPublicToolContract("outlit_list_behavior_metric_sources")
    const eventsContract = getPublicToolContract("outlit_list_behavior_metric_events")
    const contract = getPublicToolContract("outlit_create_behavior_metric")

    expect(sourcesContract.commandId).toBe("behavior_metric_source.list")
    expect(sourcesContract.inputSchema).toEqual(expect.objectContaining({ type: "object" }))
    expect(sourcesContract.outputSchema).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          sources: expect.objectContaining({ type: "array" }),
        }),
      }),
    )
    expect(eventsContract.commandId).toBe("behavior_metric_event.list")
    expect(eventsContract.inputSchema).toEqual(
      expect.objectContaining({
        required: ["sourceKey"],
        properties: expect.objectContaining({
          weeks: expect.objectContaining({ default: 12, minimum: 1, maximum: 53 }),
          limit: expect.objectContaining({ default: 100, minimum: 1, maximum: 100 }),
        }),
      }),
    )
    expect(contract.commandId).toBe("behavior_metric.create")
    expect(contract.inputSchema).toEqual(
      expect.objectContaining({
        required: ["sourceKey", "eventName", "behaviorKey", "label"],
        properties: expect.objectContaining({
          sourceKey: expect.objectContaining({
            pattern: "^metric_source_v1_[a-f0-9]{32}$",
          }),
          eventName: expect.objectContaining({ minLength: 1, maxLength: 191 }),
          behaviorKey: expect.objectContaining({ maxLength: 64 }),
          label: expect.objectContaining({ minLength: 1, maxLength: 255 }),
          propertyFilters: expect.objectContaining({ default: [], maxItems: 5 }),
        }),
      }),
    )
    expect(defaultToolNames).not.toContain("outlit_create_behavior_metric")
    expect(analyticalToolNames).not.toContain("outlit_create_behavior_metric")
    expect(cliToolNames).toContain("outlit_create_behavior_metric")
    for (const toolName of [
      "outlit_list_behavior_metric_sources",
      "outlit_list_behavior_metric_events",
      "outlit_create_behavior_metric",
    ] as const) {
      expect(defaultToolNames).not.toContain(toolName)
      expect(analyticalToolNames).not.toContain(toolName)
      expect(piToolNames).not.toContain(toolName)
      expect(cliToolNames).toContain(toolName)
    }
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
      { type?: string; enum?: readonly string[] }
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
    expect(sdkConsumerContractHash).toMatch(/^[a-f0-9]{64}$/)

    const activatedSincePattern = customerProperties.activatedSince?.pattern
    expect(activatedSincePattern).toBeDefined()
    const activatedSinceRegex = new RegExp(activatedSincePattern ?? "")
    expect(activatedSinceRegex.test("2026-07-01T00:00:00.000Z")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01T00:00:00+05:30")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01")).toBe(false)
  })

  test("exposes bounded customer enrichment and explicit MRR calculation state", () => {
    const contract = getPublicToolContract("outlit_get_customer")
    const inputProperties = contract.inputSchema.properties as Record<string, unknown>
    const outputProperties = (contract.outputSchema as { properties: Record<string, unknown> })
      .properties

    expect(inputProperties.customer).toEqual(
      expect.objectContaining({ type: "string", minLength: 1, maxLength: 500 }),
    )
    expect(inputProperties.include).toEqual(
      expect.objectContaining({
        items: expect.objectContaining({ enum: expect.arrayContaining(["enrichment"]) }),
      }),
    )
    expect(outputProperties.enrichment).toEqual(expect.objectContaining({ type: "object" }))
    expect(outputProperties.revenue).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          currentMrr: expect.objectContaining({ anyOf: expect.any(Array) }),
          mrrCalculationStatus: expect.objectContaining({
            enum: ["calculated", "mixed_currency", "unavailable"],
          }),
        }),
      }),
    )
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
      { items?: { enum?: readonly string[] } }
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
      { enum?: readonly string[] }
    >
    expect(exactSourceProperties.sourceType?.enum).toEqual(customerSourceTypeInputs)

    const searchContract = getPublicToolContract("outlit_search_customer_context")
    const searchProperties = searchContract.inputSchema.properties as Record<
      string,
      { items?: { enum?: readonly string[] } }
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

  test("forwards a caller deadline signal to the gateway request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const controller = new AbortController()
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: fetchMock,
    })

    await client.callTool("outlit_get_integration_status", {}, { signal: controller.signal })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.outlit.ai/api/tools/call",
      expect.objectContaining({ signal: controller.signal }),
    )
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
