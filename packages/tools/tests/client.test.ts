import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, expectTypeOf, test, vi } from "vitest"

import {
  type ApiKeyValidationSuccessV2,
  type AttentionItemResult,
  type AttentionItemSummary,
  type AttentionListResult,
  allPublicToolNames,
  analyticalToolNames,
  apiKeyContractHeader,
  apiKeyGrants,
  apiKeyValidationSuccessSchema,
  apiKeyValidationSuccessSchemaV2,
  apiKeyValidationTransport,
  type CustomerAnalyticsRow,
  type CustomerContextSearchInput,
  type CustomerCredit,
  type CustomerCreditsSection,
  type CustomerDetail,
  type CustomerDetailResult,
  type CustomerFeature,
  type CustomerFeaturesSection,
  type CustomerListItem,
  type CustomerListResult,
  type CustomerMeter,
  type CustomerRelationship,
  type CustomerRelationshipSection,
  cliToolNames,
  createOutlitClient,
  customerIncludeSections,
  customerSourceTypeInputs,
  customerSourceTypes,
  defaultToolNames,
  type Feature,
  type FeatureArchiveResult,
  type FeatureCreateResult,
  type FeatureDefinition,
  type FeatureListResult,
  type FeatureRef,
  getPublicToolContract,
  getToolset,
  isOutlitToolsApiError,
  matchesGeneratedJsonSchema,
  normalizeCustomerSourceToolInput,
  normalizeCustomerSourceType,
  piToolNames,
  publicOpenApiTransports,
  resolveCustomerContextSearchInput,
  sdkConsumerContractHash,
  sourceTypes,
  sqlToolNames,
  timelineOccurredAtBases,
  toolFactCategories,
  toolFactStatuses,
  toolFactTypes,
  toolGatewayErrorCodes,
  toolGatewayErrorSchema,
  toolNamesInToolsets,
  toolsetNames,
  toolTimelineChannels,
  toToolSourceType,
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
      "outlit_list_customer_fields",
      "outlit_get_customer",
      "outlit_list_people",
      "outlit_list_members",
      "outlit_set_customer_owner",
      "outlit_set_customer_access",
      "outlit_get_timeline",
      "outlit_list_facts",
      "outlit_get_fact",
      "outlit_get_source",
      "outlit_list_sources",
      "outlit_search_customer_context",
      "outlit_query",
      "outlit_get_schema",
      "outlit_list_destinations",
      "outlit_create_destination",
      "outlit_update_destination",
      "outlit_archive_destination",
      "outlit_submit_feedback",
      "outlit_list_toolsets",
      "outlit_load_toolset",
      "outlit_list_integrations",
      "outlit_setup_integration",
      "outlit_get_setup_session",
      "outlit_preview_activation",
      "outlit_get_settings",
      "outlit_update_settings",
      "outlit_list_features",
      "outlit_create_feature",
      "outlit_archive_feature",
      "outlit_list_cases",
      "outlit_get_case",
      "outlit_list_tasks",
      "outlit_get_task",
      "outlit_act_on_task",
      "outlit_undo_task_action",
      "outlit_get_identity",
      "outlit_list_merge_suggestions",
      "outlit_reject_merge_suggestion",
      "outlit_merge_customers",
      "outlit_get_merge",
    ])
    expect(allPublicToolNames).toHaveLength(42)
    expect(allPublicToolNames).not.toContain("outlit_send_notification")
    expect(allPublicToolNames).not.toContain("outlit_submit_agent_output")
  })

  test("keeps the default agent toolset to the ten read-only intelligence tools", () => {
    expect(defaultToolNames).toEqual([
      "outlit_list_customers",
      "outlit_list_customer_fields",
      "outlit_list_people",
      "outlit_get_customer",
      "outlit_get_timeline",
      "outlit_list_facts",
      "outlit_get_fact",
      "outlit_get_source",
      "outlit_list_sources",
      "outlit_search_customer_context",
    ])
    expect(sqlToolNames).toEqual(["outlit_query", "outlit_get_schema"])
    expect(piToolNames).toEqual(allPublicToolNames)
    expect(cliToolNames).toEqual(allPublicToolNames)
    for (const toolName of ["outlit_list_cases", "outlit_get_case"] as const) {
      expect(defaultToolNames).not.toContain(toolName)
      expect(analyticalToolNames).not.toContain(toolName)
      expect(piToolNames).toContain(toolName)
      expect(cliToolNames).toContain(toolName)
    }
    for (const toolName of [
      "outlit_list_features",
      "outlit_create_feature",
      "outlit_archive_feature",
      "outlit_list_toolsets",
      "outlit_load_toolset",
    ] as const) {
      expect(defaultToolNames).not.toContain(toolName)
      expect(analyticalToolNames).not.toContain(toolName)
      expect(piToolNames).toContain(toolName)
      expect(cliToolNames).toContain(toolName)
    }
  })

  test("groups every public tool into one of Core's toolsets", () => {
    expect(toolsetNames).toEqual(["core", "work", "identity", "admin", "meta"])
    for (const toolName of allPublicToolNames) {
      expect(toolsetNames).toContain(getToolset(toolName))
    }
    expect(toolNamesInToolsets(["core"])).toEqual(
      expect.arrayContaining([...defaultToolNames, ...sqlToolNames]),
    )
    expect(toolNamesInToolsets(["core", "work", "meta"])).toHaveLength(
      toolNamesInToolsets(["core"]).length +
        toolNamesInToolsets(["work"]).length +
        toolNamesInToolsets(["meta"]).length,
    )
    expect(toolNamesInToolsets([])).toEqual([])
  })

  test("exposes an analytical agent toolset with only default tools plus SQL", () => {
    expect(analyticalToolNames).toEqual([...defaultToolNames, "outlit_query", "outlit_get_schema"])
  })
})

describe("tool contracts", () => {
  test("exposes the Core merge impact scope without making unavailable counts mandatory", () => {
    const suggestions = getPublicToolContract("outlit_list_merge_suggestions")
    const item = suggestions.outputSchema.properties.items.items
    const impact = item.properties.impact
    const scope = item.properties.scope

    expect(scope.properties.availability.required).toEqual(["currentCounts", "analytics"])
    expect(scope.properties.payingAccountsAffected.anyOf).toEqual([
      expect.objectContaining({ type: "integer" }),
      { type: "null" },
    ])
    expect(scope.properties.moves.properties.analyticsEvents.anyOf).toEqual([
      expect.objectContaining({ type: "integer" }),
      { type: "null" },
    ])
    expect(impact.required).not.toContain("analyticsAvailable")
  })

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
    expect(publicOpenApiTransports).toHaveLength(4)
    expect(new Set(publicOpenApiTransports.map((transport) => transport.openApiPath)).size).toBe(4)
    expect(
      publicOpenApiTransports.some(
        (transport) => transport.openApiPath === "/api/feedback" && transport.method === "POST",
      ),
    ).toBe(true)
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

  test("exports the v2 API key validation contract beside an unchanged v1", () => {
    const v1 = {
      valid: true,
      organizationId: "org_1",
      createdById: "user_1",
      apiKey: {
        id: "key_1",
        name: "Laptop",
        prefix: "ok_abc",
        keyType: "cli",
        grants: ["customer_intelligence:read"],
        createdAt: "2026-10-01T00:00:00.000Z",
        lastUsedAt: null,
        totalRequests: 3,
      },
      authorization: { grants: ["customer_intelligence:read"] },
    }
    const v2 = { ...v1, apiKey: { ...v1.apiKey, expiresAt: "2027-01-03T00:00:00.000Z" } }

    expect(apiKeyContractHeader).toBe("Outlit-Api-Key-Contract")
    expect(matchesGeneratedJsonSchema(v1, apiKeyValidationSuccessSchema)).toBe(true)
    expect(matchesGeneratedJsonSchema(v2, apiKeyValidationSuccessSchema)).toBe(false)
    expect(matchesGeneratedJsonSchema(v2, apiKeyValidationSuccessSchemaV2)).toBe(true)
    expect(matchesGeneratedJsonSchema(v1, apiKeyValidationSuccessSchemaV2)).toBe(false)
    expectTypeOf<NonNullable<ApiKeyValidationSuccessV2["apiKey"]>["expiresAt"]>().toEqualTypeOf<
      string | null
    >()
  })

  test("types nullable company activation on customer and analytics results", () => {
    const analyticsRow: CustomerAnalyticsRow = {
      activated_at: null,
    }

    expectTypeOf<CustomerListItem["activatedAt"]>().toEqualTypeOf<string | null>()
    expectTypeOf<CustomerDetail["activatedAt"]>().toEqualTypeOf<string | null>()
    expect(analyticsRow.activated_at).toBeNull()
  })

  test("exports generated case result types with Core-owned ARR at assessment as Money", () => {
    expectTypeOf<AttentionListResult["items"][number]>().toEqualTypeOf<AttentionItemSummary>()
    expectTypeOf<
      NonNullable<AttentionItemResult["importance"]["arrAtAssessment"]>["amount"]
    >().toEqualTypeOf<number>()
    expectTypeOf<AttentionItemSummary["importance"]["shareWithinCurrency"]>().toEqualTypeOf<
      number | null
    >()
  })

  test("projects the product-facing Feature lifecycle and customer usage contracts", () => {
    const workspace = getPublicToolContract("outlit_list_features")
    const create = getPublicToolContract("outlit_create_feature")
    const archive = getPublicToolContract("outlit_archive_feature")
    const customer = getPublicToolContract("outlit_get_customer")

    expect(workspace.commandId).toBe("value_feature_workspace.get")
    const filters = workspace.inputSchema.properties.filters as unknown as {
      properties: Record<string, unknown>
    }
    expect(filters.properties).toEqual(
      expect.objectContaining({
        sourceKey: expect.objectContaining({ type: "string" }),
        eventSearch: expect.objectContaining({ type: "string" }),
      }),
    )
    expect(workspace.inputSchema.properties).toEqual(
      expect.objectContaining({
        weeks: expect.objectContaining({ default: 12, minimum: 1, maximum: 53 }),
        candidateLimit: expect.objectContaining({ default: 25, minimum: 1, maximum: 100 }),
        include: expect.objectContaining({ type: "array" }),
      }),
    )
    expect(workspace.outputSchema.properties).not.toHaveProperty("features")
    expect(workspace.outputSchema.properties).toEqual(
      expect.objectContaining({
        items: expect.objectContaining({ type: "array" }),
        workspaceActiveFeatures: expect.anything(),
        sources: expect.objectContaining({ type: "array" }),
        candidates: expect.anything(),
      }),
    )
    expect(create.commandId).toBe("value_feature.create")
    expect(create.inputSchema.required).toEqual([
      "sourceKey",
      "eventName",
      "featureKey",
      "name",
      "requestId",
    ])
    expect(create.inputSchema.properties.propertyFilters).toEqual(
      expect.objectContaining({ default: [], maxItems: 5 }),
    )
    expect(archive.commandId).toBe("value_feature.archive")
    expect(archive.inputSchema.required).toEqual(["id", "revision", "requestId"])
    expect(archive.inputSchema.properties).toEqual(
      expect.objectContaining({
        mode: expect.objectContaining({ enum: ["preview", "execute"] }),
        previewToken: expect.objectContaining({ type: "string" }),
      }),
    )
    expect(archive.inputSchema.properties).not.toHaveProperty("restore")
    expect(customer.inputSchema.required).toEqual(["customer"])
    expect(customer.inputSchema.properties.include.items.enum).toEqual(
      expect.arrayContaining(["features", "meters", "credits", "relationship"]),
    )
    // Event features and Autumn meters are separate sections, each paged on its own.
    expect(customer.inputSchema.properties.features.properties.limit).toEqual(
      expect.objectContaining({ default: 25, minimum: 1, maximum: 100 }),
    )
    expect(customer.inputSchema.properties.meters.properties.weeks).toEqual(
      expect.objectContaining({ default: 12, minimum: 1, maximum: 53 }),
    )
    expect(customer.inputSchema.properties.credits.properties).not.toHaveProperty("weeks")

    const publicContractText = JSON.stringify([workspace, create, archive])
    expect(publicContractText).not.toMatch(
      /Behavior Metric|metric pair|Churn clock|Stripe|entitlement/i,
    )
  })

  test("exports generated Feature and customer usage result aliases", () => {
    type ArchivedFeature = Extract<FeatureArchiveResult, { archived: true }>
    type FeatureUsage = NonNullable<Feature["usage"]>
    type CandidatesSection = NonNullable<FeatureListResult["candidates"]>
    type Candidates = Extract<CandidatesSection, { status: "available" }>["data"]

    expectTypeOf<FeatureListResult["items"][number]>().toEqualTypeOf<Feature>()
    expectTypeOf<Candidates["items"][number]["eventName"]>().toEqualTypeOf<string>()
    expectTypeOf<Candidates["truncated"]>().toEqualTypeOf<boolean>()
    expectTypeOf<Candidates["coverage"]>().toEqualTypeOf<"complete" | "partial">()
    expectTypeOf<FeatureUsage["status"]>().toExtend<string>()
    expectTypeOf<FeatureCreateResult["feature"]>().toEqualTypeOf<FeatureDefinition>()
    expectTypeOf<ArchivedFeature["feature"]>().toEqualTypeOf<FeatureRef>()
    expectTypeOf<CustomerFeature["kind"]>().toEqualTypeOf<"event">()
    expectTypeOf<CustomerFeature["evidence"]["coverage"]>().toEqualTypeOf<
      "complete" | "partial" | "unavailable"
    >()
    expectTypeOf<CustomerMeter["kind"]>().toEqualTypeOf<"metered">()
    expectTypeOf<CustomerMeter["unit"]>().toEqualTypeOf<"provider_defined">()
  })

  test("says why a feature section has no data instead of returning an empty list", () => {
    const contract = getPublicToolContract("outlit_get_customer")
    const features = contract.outputSchema.properties.features
    const available = {
      status: "available",
      asOf: "2026-11-10T00:00:00.000Z",
      data: {
        window: { startAt: "2026-08-18T00:00:00.000Z", endAt: "2026-11-10T00:00:00.000Z" },
        items: [],
        page: { hasMore: false, nextCursor: null, total: 0 },
      },
    } satisfies CustomerFeaturesSection

    expect(matchesGeneratedJsonSchema(available, features)).toBe(true)
    expect(
      matchesGeneratedJsonSchema(
        { status: "not_connected", reason: "No product-event source is connected." },
        features,
      ),
    ).toBe(true)
    // An unavailable read carries its reason; a bare status or an unknown one is not a section.
    expect(matchesGeneratedJsonSchema({ status: "unavailable" }, features)).toBe(false)
    expect(matchesGeneratedJsonSchema({ status: "unknown", reason: "invented" }, features)).toBe(
      false,
    )
    const { data: _data, ...missingData } = available
    expect(matchesGeneratedJsonSchema(missingData, features)).toBe(false)
  })

  test("infers activatedAt on typed customer list and get client results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [],
            page: { hasMore: false, nextCursor: null, total: 0 },
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
            },
            relationship: {
              summary: null,
              items: [],
              updatedAt: null,
            },
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
    const relationshipResult = await client.callTool("outlit_get_customer", {
      customer: "acme.com",
      include: ["relationship"],
    })
    const detailResult = await client.callTool("outlit_get_customer", {
      customer: "acme.com",
    })

    expectTypeOf(listResult).toEqualTypeOf<CustomerListResult>()
    expectTypeOf(detailResult).toEqualTypeOf<CustomerDetailResult>()
    expectTypeOf(detailResult.customer).toEqualTypeOf<CustomerDetail>()
    expectTypeOf(relationshipResult).toEqualTypeOf<CustomerDetailResult>()
    expectTypeOf(relationshipResult.relationship).toEqualTypeOf<
      CustomerRelationshipSection | undefined
    >()
    expectTypeOf<
      Extract<CustomerRelationshipSection, { status: "available" }>["data"]
    >().toEqualTypeOf<CustomerRelationship>()
  })

  test("exposes workspace users and customer owner filters", () => {
    const membersContract = getPublicToolContract("outlit_list_members")
    const memberProperties = membersContract.inputSchema.properties as Record<
      string,
      { type?: string; enum?: readonly string[]; properties?: Record<string, unknown> }
    >

    expect(memberProperties.filters?.properties?.search).toEqual(
      expect.objectContaining({
        type: "string",
      }),
    )
    expect(memberProperties.filters?.properties?.hasOwnedCustomers).toEqual(
      expect.objectContaining({
        type: "boolean",
      }),
    )
    expect(memberProperties.orderBy?.enum).toEqual(["owned_customers", "name"])

    const customerContract = getPublicToolContract("outlit_list_customers")
    type ObjectSchema = { properties: Record<string, Record<string, unknown>> }
    const filters = customerContract.inputSchema.properties.filters as unknown as ObjectSchema
    const owner = filters.properties.owner as unknown as ObjectSchema
    const activity = filters.properties.activity as unknown as ObjectSchema

    expect(customerContract.inputSchema.properties).not.toHaveProperty("ownerId")
    expect(owner.properties.id).toEqual(expect.objectContaining({ type: "string" }))
    expect(owner.properties.email).toEqual(expect.objectContaining({ type: "string" }))
    expect(owner.properties.has).toEqual(expect.objectContaining({ type: "boolean" }))
    expect(activity.properties.activatedSince).toEqual(
      expect.objectContaining({
        type: "string",
        format: "date-time",
      }),
    )
    expect(sdkConsumerContractHash).toMatch(/^[a-f0-9]{64}$/)

    const activatedSincePattern = activity.properties.activatedSince?.pattern
    expect(activatedSincePattern).toBeDefined()
    const activatedSinceRegex = new RegExp(String(activatedSincePattern ?? ""))
    expect(activatedSinceRegex.test("2026-07-01T00:00:00.000Z")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01T00:00:00+05:30")).toBe(true)
    expect(activatedSinceRegex.test("2026-07-01")).toBe(false)
  })

  test("exposes bounded customer enrichment, renewal and ARR", () => {
    const contract = getPublicToolContract("outlit_get_customer")
    const inputProperties = contract.inputSchema.properties as Record<string, unknown>
    const outputProperties = (contract.outputSchema as { properties: Record<string, unknown> })
      .properties

    expect(inputProperties.customer).toEqual(
      expect.objectContaining({ type: "string", minLength: 1, maxLength: 500 }),
    )
    expect(inputProperties.include).toEqual(
      expect.objectContaining({
        items: expect.objectContaining({
          enum: expect.arrayContaining(["enrichment", "renewal"]),
        }),
      }),
    )
    const section = (name: string) => outputProperties[name] as { oneOf: unknown[] }
    // Every include is a section: available with its data, or a status saying why there is none.
    for (const name of ["users", "revenue", "billing", "enrichment", "renewal", "crm", "links"]) {
      expect(section(name).oneOf).toHaveLength(2)
    }
    expect(JSON.stringify(section("revenue"))).toContain("lifetimeRevenue")
    expect(JSON.stringify(section("billing"))).toContain("overdueInvoices")
  })

  test("validates the customer credits and meters sections and their result aliases", () => {
    const contract = getPublicToolContract("outlit_get_customer")
    const credits = contract.outputSchema.properties.credits
    const credit = {
      id: "credit_1",
      name: "API credits",
      source: {
        provider: "autumn",
        connection: "connection_1",
        account: "account_1",
        environment: "live",
      },
      observed: "2026-09-12T00:00:00.000Z",
      stale: false,
      scope: "customer",
      granted: 1000,
      remaining: 600,
      unlimited: false,
      overage: false,
      reset: "2026-10-01T00:00:00.000Z",
      burn: {
        rate: 120,
        scope: "customer_balance",
        change: 20,
        days: 5,
        depletion: "2026-09-17T00:00:00.000Z",
        status: "available",
        window: { start: "2026-09-05", end: "2026-09-12" },
        trend: [{ date: "2026-09-11", usage: 140, rate: 120 }],
      },
    } satisfies CustomerCredit
    const result = {
      status: "available",
      asOf: "2026-09-12T00:00:00.000Z",
      data: {
        items: [credit],
        page: { hasMore: false, nextCursor: null, total: 1 },
        complete: true,
      },
    } satisfies CustomerCreditsSection

    expect(contract.commandId).toBe("customer.get")
    expect(contract.inputSchema.properties.include.items.enum).toContain("credits")
    expect(customerIncludeSections).not.toContain("featureBalances")
    expectTypeOf<CustomerCredit["burn"]["rate"]>().toEqualTypeOf<number | null>()
    expectTypeOf<CustomerCredit["scope"]>().toEqualTypeOf<"customer">()
    expect(matchesGeneratedJsonSchema(result, credits)).toBe(true)
    expect(matchesGeneratedJsonSchema({ ...result, status: "invented" }, credits)).toBe(false)
    expect(
      matchesGeneratedJsonSchema(
        { ...result, data: { ...result.data, items: [{ ...credit, scope: "account" }] } },
        credits,
      ),
    ).toBe(false)
  })

  test("accepts Autumn direct API-key setup through the generated public contract", () => {
    const contract = getPublicToolContract("outlit_setup_integration")

    expect(
      matchesGeneratedJsonSchema(
        {
          provider: "autumn",
          credentials: { apiKey: "am_sk_test_example" },
          requestId: "request_autumn_1",
        },
        contract.inputSchema,
      ),
    ).toBe(true)
  })

  test("exposes lowercase fact type and category filters under filters on facts listing", () => {
    const contract = getPublicToolContract("outlit_list_facts")
    const properties = contract.inputSchema.properties as Record<string, unknown>

    expect(properties).not.toHaveProperty("factTypes")
    expect(properties).not.toHaveProperty("factCategories")
    const filters = (properties.filters as { properties: Record<string, unknown> }).properties

    expect(filters.types).toEqual(
      expect.objectContaining({
        type: "array",
        items: expect.objectContaining({
          enum: expect.arrayContaining([
            "churn_risk",
            "expansion",
            "champion_risk",
            "contact_departure",
            "contact_position_change",
            "contact_disengagement",
          ]),
        }),
      }),
    )
    expect(filters.categories).toEqual(
      expect.objectContaining({
        type: "array",
        items: expect.objectContaining({
          enum: ["memory", "relationship", "custom"],
        }),
      }),
    )
    expect(filters.status).toEqual(
      expect.objectContaining({ items: expect.objectContaining({ enum: [...toolFactStatuses] }) }),
    )
  })

  test("keeps anomaly detector filters out of the facts listing schema", () => {
    const contract = getPublicToolContract("outlit_list_facts")
    const filters = (
      contract.inputSchema.properties as {
        filters: { properties: Record<string, { items?: { enum?: readonly string[] } }> }
      }
    ).filters.properties

    expect(filters.types?.items?.enum).toEqual([...toolFactTypes])
    expect(filters.types?.items?.enum).not.toContain("core_action_decay")
    expect(filters.types?.items?.enum).not.toContain("activation_rate_drop")
    expect(filters.types?.items?.enum).not.toContain("champion_at_risk")
    expect(filters.categories?.items?.enum).not.toContain("churn")
    expect(filters.categories?.items?.enum).not.toContain("journey")
  })

  test("exposes canonical source types while scoping EXTRACTED to exact lookups", () => {
    expect(customerSourceTypes).toEqual([
      "EMAIL",
      "CALL",
      "CALENDAR_EVENT",
      "SUPPORT_TICKET",
      "OPPORTUNITY",
      "SLACK",
      "PERSON_PROFILE",
      "INVOICE",
      "CRM_NOTE",
    ])
    expect(customerSourceTypeInputs).toEqual([
      "EMAIL",
      "CALL",
      "CALENDAR_EVENT",
      "SUPPORT_TICKET",
      "OPPORTUNITY",
      "SLACK",
      "PERSON_PROFILE",
      "INVOICE",
      "CRM_NOTE",
      "CRM",
      "CRM_OPPORTUNITY",
    ])
    expect(normalizeCustomerSourceType("CRM")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType("CRM_OPPORTUNITY")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType("crm")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType(" crm_opportunity ")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType(" opportunity ")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceType(" person_profile ")).toBe("PERSON_PROFILE")
    expect(normalizeCustomerSourceType("STRIPE_INVOICE")).toBeNull()
    expect(normalizeCustomerSourceToolInput(" Stripe_Invoice ")).toBe("INVOICE")
    expect(normalizeCustomerSourceToolInput("invoice")).toBe("INVOICE")
    expect(normalizeCustomerSourceToolInput("crm")).toBe("OPPORTUNITY")
    expect(normalizeCustomerSourceToolInput("ZENDESK_TICKET")).toBeNull()
    expect(normalizeCustomerSourceToolInput("constructor")).toBeNull()
    expect(normalizeCustomerSourceType("ZENDESK_TICKET")).toBeNull()
    expect(normalizeCustomerSourceType("toString")).toBeNull()
    expect(normalizeCustomerSourceType("constructor")).toBeNull()
    expect(normalizeCustomerSourceType("__proto__")).toBeNull()

    const exactSourceContract = getPublicToolContract("outlit_get_source")
    const exactSourceProperties = exactSourceContract.inputSchema.properties as Record<
      string,
      { properties?: { type?: { enum?: readonly string[] } } }
    >
    // get_source takes one source {type, id}; only it accepts `extracted` (a memory entry).
    expect(exactSourceProperties.source?.properties?.type?.enum).toEqual([
      ...sourceTypes,
      "extracted",
    ])

    const searchContract = getPublicToolContract("outlit_search_customer_context")
    const searchFilters = (
      searchContract.inputSchema.properties as {
        filters: { properties: { sourceTypes?: { items?: { enum?: readonly string[] } } } }
      }
    ).filters.properties
    expect(searchFilters.sourceTypes?.items?.enum).toEqual([...sourceTypes])
    expect(searchFilters.sourceTypes?.items?.enum).not.toContain("extracted")
  })

  test("spells every context tool's enums in lowercase", () => {
    expect(sourceTypes).toEqual([
      "email",
      "call",
      "calendar_event",
      "support_ticket",
      "opportunity",
      "slack",
      "person_profile",
      "invoice",
      "crm_note",
    ])
    expect(toolTimelineChannels).toEqual([
      "product",
      "communication",
      "meeting",
      "crm",
      "billing",
      "support",
      "identity",
      "document",
      "system",
    ])
    expect(toolFactCategories).toEqual(["memory", "relationship", "custom"])
    expect(timelineOccurredAtBases).toEqual(["record", "first_observed"])
    expect(toToolSourceType("CALENDAR_EVENT")).toBe("calendar_event")
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

  test("forwards a caller deadline signal to the gateway request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const controller = new AbortController()
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: fetchMock,
    })

    await client.callTool("outlit_list_integrations", {}, { signal: controller.signal })

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

  test("keeps an idempotency conflict with the call that resolves it", async () => {
    const envelope = {
      code: "IDEMPOTENCY_CONFLICT",
      message: "This request id was used with different input.",
      retryable: false,
      requestId: "request_456",
      next: { instruction: "Send a new request id, or repeat the original input." },
    }
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status: 409 })),
    })

    const error = await client.callTool("outlit_list_customers").catch((value: unknown) => value)
    if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
    expect(toolGatewayErrorCodes).toContain("IDEMPOTENCY_CONFLICT")
    expect(error.envelope).toEqual(envelope)
  })

  test("reports a deprecation, notices and a replay marker from the response headers", async () => {
    const deprecation = {
      tool: "outlit_list_users",
      use: "outlit_list_people",
      until: "2026-12-11",
      message: "outlit_list_users is deprecated: use outlit_list_people.",
    }
    const onResponse = vi.fn()
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      onResponse,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: {
            "outlit-deprecation": JSON.stringify(deprecation),
            Deprecation: "true",
            Sunset: "Fri, 11 Dec 2026 00:00:00 GMT",
            "outlit-notice": JSON.stringify(["limit 500 was lowered to 100."]),
            "idempotent-replayed": "true",
          },
        }),
      ),
    })

    await client.callTool("outlit_list_people")

    expect(onResponse).toHaveBeenCalledWith({
      tool: "outlit_list_people",
      status: 200,
      deprecation,
      sunset: "Fri, 11 Dec 2026 00:00:00 GMT",
      notices: ["limit 500 was lowered to 100."],
      replayed: true,
    })
  })

  test("reports plain responses with no notices, and a throwing hook cannot fail the call", async () => {
    const seen: unknown[] = []
    const plain = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      onResponse: (info) => seen.push(info),
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    })
    await plain.callTool("outlit_list_people")
    expect(seen).toEqual([
      { tool: "outlit_list_people", status: 200, notices: [], replayed: false },
    ])

    const throwing = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      onResponse: () => {
        throw new Error("hook failed")
      },
      fetch: vi.fn().mockResolvedValue(new Response('{"items":[]}', { status: 200 })),
    })
    await expect(throwing.callTool("outlit_list_people")).resolves.toEqual({ items: [] })
  })

  test("preserves non-retryable missing-resource feedback from Core", async () => {
    const envelope = {
      code: "TOOL_RESOURCE_NOT_FOUND",
      message: "Resource not found",
      retryable: false,
      requestId: "request_missing_fact",
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(envelope), { status: 404 }))
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: fetchMock,
    })

    const error = await client
      .callTool("outlit_get_fact", { factId: "10000000-0000-4000-8000-000000000001" })
      .catch((value: unknown) => value)

    expect(isOutlitToolsApiError(error)).toBe(true)
    if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
    expect(error.status).toBe(404)
    expect(error.envelope).toEqual(envelope)
    expect(fetchMock).toHaveBeenCalledTimes(1)
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
        requestId: "request_bad_next",
        next: { tool: "outlit_list_customers" },
      },
      {
        code: "INVALID_TOOL_INPUT",
        message: "Invalid input",
        retryable: false,
        requestId: "request_permission_on_other_code",
        missingPermission: "integrations:manage",
      },
    ]
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidEnvelopes[0]), { status: 403 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidEnvelopes[1]), { status: 403 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidEnvelopes[2]), { status: 400 })),
    })

    for (const _invalidEnvelope of invalidEnvelopes) {
      const error = await client.callTool("outlit_list_customers").catch((value: unknown) => value)
      expect(isOutlitToolsApiError(error)).toBe(true)
      if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
      expect(error.envelope).toBeUndefined()
    }
  })

  test("keeps a missing permission on a forbidden call", async () => {
    const envelope = {
      code: "TOOL_CALL_FORBIDDEN",
      message: "Capability not authorized",
      retryable: false,
      requestId: "request_forbidden_permission",
      missingPermission: "integrations:manage",
    }
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status: 403 })),
    })

    const error = await client.callTool("outlit_list_customers").catch((value: unknown) => value)
    if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
    expect(error.envelope).toEqual(envelope)
  })

  test("keeps the envelope and drops top-level fields this build does not know", async () => {
    const known = {
      code: "INVALID_TOOL_INPUT",
      message: "Invalid input",
      retryable: false,
      requestId: "request_newer_gateway",
      validationIssues: [
        { code: "invalid_value", path: "billingStatus", validValues: ["paying", "trialing"] },
      ],
      next: { instruction: "Use one of the valid values for billingStatus." },
    }
    const client = createOutlitClient({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...known, internalDetail: "must not cross the gateway boundary" }),
            { status: 400 },
          ),
        ),
    })

    const error = await client.callTool("outlit_list_customers").catch((value: unknown) => value)
    if (!isOutlitToolsApiError(error)) throw new Error("expected OutlitToolsApiError")
    expect(error.envelope).toEqual(known)
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

  test("rejects STRIPE_INVOICE in search input, which only the source tools accept", () => {
    const result = resolveCustomerContextSearchInput({
      query: "invoices",
      sourceTypes: ["stripe_invoice"],
    })

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("Unknown source types: stripe_invoice."),
    })
    expect(result.ok ? "" : result.message).not.toMatch(/Allowed:.*STRIPE_INVOICE/)
    expect(customerSourceTypeInputs).not.toContain("STRIPE_INVOICE")
  })

  test("normalizes source types and CRM aliases into lowercase filters", () => {
    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: ["slack"],
      }),
    ).toEqual({
      ok: true,
      request: { query: "renewal", filters: { sourceTypes: ["slack"] } },
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: ["CALL", "CRM"],
      }),
    ).toEqual({
      ok: true,
      request: { query: "renewal", filters: { sourceTypes: ["call", "opportunity"] } },
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: [" call ", "crm_opportunity", "opportunity"],
      }),
    ).toEqual({
      ok: true,
      request: { query: "renewal", filters: { sourceTypes: ["call", "opportunity"] } },
    })

    expect(
      resolveCustomerContextSearchInput({
        query: "renewal",
        sourceTypes: ["ZENDESK_TICKET"],
      }),
    ).toEqual({
      ok: false,
      message:
        "Unknown source types: ZENDESK_TICKET. Allowed: email, call, calendar_event, support_ticket, opportunity, slack, person_profile, invoice, crm_note",
    })
  })

  test("sends limit, and dates under filters; topK is the previous spelling of limit", () => {
    expect(
      resolveCustomerContextSearchInput({
        query: "pricing",
        customer: "acme.com",
        limit: 10,
        after: "2025-01-01T00:00:00Z",
        before: "2025-03-31T23:59:59Z",
      }),
    ).toEqual({
      ok: true,
      request: {
        query: "pricing",
        customer: "acme.com",
        limit: 10,
        filters: { after: "2025-01-01T00:00:00Z", before: "2025-03-31T23:59:59Z" },
      },
    })

    expect(resolveCustomerContextSearchInput({ query: "pricing", topK: 7 })).toEqual({
      ok: true,
      request: { query: "pricing", limit: 7 },
    })
  })
})
