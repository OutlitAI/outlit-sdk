import { existsSync, readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import { allCustomerToolNames } from "../../packages/tools/src/toolsets.js"

type OpenApiSpec = {
  openapi: string
  security?: Array<Record<string, unknown>>
  servers?: Array<{ url: string }>
  paths?: Record<string, Record<string, unknown>>
  components?: {
    securitySchemes?: Record<string, unknown>
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"))
}

function collectRefs(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectRefs)
  }

  const record = value as Record<string, unknown>
  const ownRef = typeof record.$ref === "string" ? [record.$ref] : []
  return [...ownRef, ...Object.values(record).flatMap(collectRefs)]
}

describe("docs OpenAPI spec", () => {
  test("publishes a parseable spec at the docs root", () => {
    expect(existsSync("docs/openapi.json")).toBe(true)

    const spec = readJson<OpenApiSpec>("docs/openapi.json")

    expect(spec.openapi).toMatch(/^3\./)
  })

  test("registers the docs-hosted spec with the API Reference tab", () => {
    const docsConfig = readJson<{
      contextual?: { options?: string[] }
      navigation?: { tabs?: Array<{ tab?: string; openapi?: string }> }
    }>("docs/docs.json")
    const apiTab = docsConfig.navigation?.tabs?.find((tab) => tab.tab === "API Reference")

    expect(apiTab?.openapi).toBe("openapi.json")
    expect(docsConfig.contextual?.options).toContain("download-spec")
  })

  test("links the API overview to the canonical downloadable spec", () => {
    const introduction = readFileSync("docs/api-reference/introduction.mdx", "utf8")

    expect(introduction).toContain("[Download the canonical OpenAPI spec](/openapi.json)")
  })

  test("documents the public platform and ingest API surfaces", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const paths = spec.paths ?? {}

    expect(spec.servers).toContainEqual({ url: "https://app.outlit.ai" })
    expect(Object.keys(paths).sort()).toEqual([
      "/api/activation",
      "/api/activation/preview",
      "/api/destinations",
      "/api/destinations/options",
      "/api/destinations/{id}",
      "/api/destinations/{id}/archive",
      "/api/destinations/{id}/disable",
      "/api/destinations/{id}/enable",
      "/api/i/v1/{publicKey}/events",
      "/api/integrations",
      "/api/integrations/capabilities",
      "/api/integrations/connect",
      "/api/integrations/connect/status",
      "/api/integrations/disconnect",
      "/api/integrations/setup-step",
      "/api/integrations/sync-status",
      "/api/settings",
      "/api/settings/report",
      "/api/settings/report/options",
      "/api/tools/call",
      "/api/validate-api-key",
    ])
  })

  test("does not publish retired generic product route families", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const paths = Object.keys(spec.paths ?? {})

    for (const prefix of ["/api/agents", "/api/agent-", "/api/automations", "/api/signals"]) {
      expect(paths.some((path) => path.startsWith(prefix))).toBe(false)
    }
    expect(paths.some((path) => path.startsWith("/api/identity/merge-suggestions"))).toBe(false)
  })

  test("publishes only ingestion event variants accepted by the platform", () => {
    const spec = readJson<{
      components?: { schemas?: Record<string, any> }
    }>("docs/openapi.json")
    const schemas = spec.components?.schemas ?? {}

    expect(schemas.IngestEvent?.oneOf).toEqual([
      { $ref: "#/components/schemas/PageviewEvent" },
      { $ref: "#/components/schemas/CustomEvent" },
      { $ref: "#/components/schemas/FormEvent" },
      { $ref: "#/components/schemas/IdentifyEvent" },
      { $ref: "#/components/schemas/EngagementEvent" },
      { $ref: "#/components/schemas/CalendarEvent" },
    ])
    expect(schemas.StageEvent).toBeUndefined()
    expect(schemas.BillingEvent).toBeUndefined()
  })

  test("applies root bearer auth while keeping ingest public", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const bearerAuth = spec.components?.securitySchemes?.bearerAuth

    expect(bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      description: "Outlit API key using the Bearer ok_... format.",
    })
    expect(spec.security).toEqual([{ bearerAuth: [] }])

    const paths = spec.paths ?? {}
    const ingestOperation = paths["/api/i/v1/{publicKey}/events"]?.post as
      | { security?: unknown }
      | undefined
    const platformOperations = Object.entries(paths).flatMap(([path, pathItem]) => {
      if (path === "/api/i/v1/{publicKey}/events") {
        return []
      }

      return Object.entries(pathItem)
        .filter(([method]) => ["delete", "get", "patch", "post", "put"].includes(method))
        .map(([method, operation]) => ({ method, operation, path }))
    })

    expect(
      platformOperations.map(({ method, path }) => `${method.toUpperCase()} ${path}`).sort(),
    ).toEqual([
      "GET /api/activation",
      "GET /api/destinations",
      "GET /api/destinations/options",
      "GET /api/destinations/{id}",
      "GET /api/integrations",
      "GET /api/integrations/capabilities",
      "GET /api/integrations/connect/status",
      "GET /api/integrations/sync-status",
      "GET /api/settings",
      "GET /api/settings/report",
      "GET /api/settings/report/options",
      "PATCH /api/activation",
      "PATCH /api/destinations/{id}",
      "PATCH /api/settings",
      "PATCH /api/settings/report",
      "POST /api/activation/preview",
      "POST /api/destinations",
      "POST /api/destinations/{id}/archive",
      "POST /api/destinations/{id}/disable",
      "POST /api/destinations/{id}/enable",
      "POST /api/integrations/connect",
      "POST /api/integrations/disconnect",
      "POST /api/integrations/setup-step",
      "POST /api/tools/call",
      "POST /api/validate-api-key",
    ])
    expect(ingestOperation?.security).toEqual([])
    for (const { operation } of platformOperations) {
      expect((operation as { security?: unknown }).security).toBeUndefined()
    }
  })

  test("bounds integration list responses to the public provider set", () => {
    const spec = readJson<{
      components?: {
        schemas?: {
          ProviderId?: { enum?: readonly string[] }
        }
      }
      paths?: Record<string, any>
    }>("docs/openapi.json")
    const providerCount = spec.components?.schemas?.ProviderId?.enum?.length
    const integrationItems =
      spec.paths?.["/api/integrations"]?.get?.responses?.["200"]?.content?.["application/json"]
        ?.schema?.properties?.items

    expect(providerCount).toBeGreaterThan(0)
    expect(integrationItems).toMatchObject({
      type: "array",
      maxItems: providerCount,
      items: { $ref: "#/components/schemas/Integration" },
    })
  })

  test("keeps tool gateway enum aligned with @outlit/tools", () => {
    const spec = readJson<{
      components?: {
        schemas?: {
          ToolCallRequest?: {
            properties?: {
              tool?: { enum?: readonly string[] }
            }
          }
        }
      }
    }>("docs/openapi.json")

    expect(spec.components?.schemas?.ToolCallRequest?.properties?.tool?.enum).toEqual([
      ...allCustomerToolNames,
    ])
  })

  test("documents strict shared-event activation contracts", () => {
    const spec = readJson<{
      paths?: Record<string, any>
      components?: {
        schemas?: Record<string, any>
      }
    }>("docs/openapi.json")
    const schemas = spec.components?.schemas ?? {}

    expect(
      spec.paths?.["/api/activation"]?.get?.responses?.["200"]?.content?.["application/json"]
        ?.schema,
    ).toEqual({
      $ref: "#/components/schemas/GetCustomerActivationCommandSuccess",
    })
    expect(
      spec.paths?.["/api/activation"]?.patch?.requestBody?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CustomerActivationUpdateRequest",
    })
    expect(
      spec.paths?.["/api/activation/preview"]?.post?.requestBody?.content?.["application/json"]
        ?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CustomerActivationPreviewRequest",
    })

    expect(schemas.CustomerActivationState).toEqual({
      type: "object",
      required: ["eventName"],
      properties: {
        eventName: {
          type: ["string", "null"],
          maxLength: 191,
        },
      },
      additionalProperties: false,
    })
    expect(schemas.CustomerActivationPreviewRequest).toEqual({
      type: "object",
      required: ["eventName"],
      properties: {
        eventName: {
          type: "string",
          minLength: 1,
          maxLength: 191,
        },
        lookbackDays: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          default: 30,
        },
        exampleLimit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          default: 10,
        },
      },
      additionalProperties: false,
    })
    expect(schemas.CustomerActivationUpdateRequest).toEqual({
      type: "object",
      required: ["eventName"],
      properties: {
        eventName: {
          description:
            "The exact ordinary product event name, or null to disable future matching without clearing activation history.",
          anyOf: [{ type: "string", minLength: 1, maxLength: 191 }, { type: "null" }],
        },
      },
      additionalProperties: false,
    })
    expect(schemas.CustomerActivationPreviewResult?.required).toEqual([
      "eventName",
      "evaluatedFrom",
      "evaluatedTo",
      "evaluatedEventCount",
      "matchedCustomerCount",
      "alreadyActivatedCustomerCount",
      "wouldActivateCustomerCount",
      "evaluatedContactOccurrenceCount",
      "matchedContactCount",
      "alreadyActivatedContactCount",
      "wouldActivateContactCount",
      "contactTruncated",
      "customerTruncated",
      "truncated",
      "examples",
    ])
    expect(schemas.CustomerActivationPreviewResult?.properties?.eventName).toEqual({
      type: "string",
      minLength: 1,
      maxLength: 191,
    })
    expect(schemas.CustomerActivationPreviewResult?.properties).toMatchObject({
      evaluatedContactOccurrenceCount: { type: "integer", minimum: 0 },
      matchedContactCount: { type: "integer", minimum: 0 },
      alreadyActivatedContactCount: { type: "integer", minimum: 0 },
      wouldActivateContactCount: { type: "integer", minimum: 0 },
      contactTruncated: { type: "boolean" },
      customerTruncated: { type: "boolean" },
    })
    expect(schemas.CustomerActivationPreviewResult?.additionalProperties).toBe(false)
    expect(schemas.CustomerActivationPreviewExample).toMatchObject({
      type: "object",
      required: ["customer", "activatedAt", "firstMatchedAt", "eventId"],
      properties: {
        activatedAt: { type: ["string", "null"], format: "date-time" },
        firstMatchedAt: { type: "string", format: "date-time" },
        eventId: { type: "string", format: "uuid" },
      },
      additionalProperties: false,
    })
    for (const removedSchema of [
      "CustomerActivationDefinitionInput",
      "CustomerActivationDefinitionRead",
      "CustomerActivationMatchMode",
      "CustomerActivationWindow",
    ]) {
      expect(schemas).not.toHaveProperty(removedSchema)
    }
  })

  test("documents searchable settings option routes", () => {
    const spec = readJson<{
      paths?: Record<string, any>
    }>("docs/openapi.json")

    for (const path of ["/api/settings/report/options", "/api/destinations/options"]) {
      const params = spec.paths?.[path]?.get?.parameters

      expect(params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "search",
            in: "query",
            schema: expect.objectContaining({
              type: "string",
              maxLength: 120,
            }),
          }),
          expect.objectContaining({
            name: "limit",
            in: "query",
            schema: expect.objectContaining({
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 50,
            }),
          }),
        ]),
      )
    }
  })

  test("uses only internal OpenAPI references", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const refs = collectRefs(spec)

    expect(refs.length).toBeGreaterThan(0)
    expect(refs.every((ref) => ref.startsWith("#/"))).toBe(true)
  })
})
