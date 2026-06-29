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
      "/api/agent-actions",
      "/api/agent-templates",
      "/api/agents",
      "/api/agents/custom",
      "/api/agents/{id}",
      "/api/agents/{id}/actions",
      "/api/agents/{id}/disable",
      "/api/agents/{id}/enable",
      "/api/agents/{id}/instructions",
      "/api/agents/{id}/profile",
      "/api/agents/{id}/rename",
      "/api/automations",
      "/api/automations/{id}",
      "/api/automations/{id}/archive",
      "/api/automations/{id}/disable",
      "/api/automations/{id}/enable",
      "/api/destinations",
      "/api/destinations/webhook",
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
      "/api/signals",
      "/api/signals/{id}",
      "/api/signals/{id}/archive",
      "/api/tools/call",
      "/api/validate-api-key",
    ])
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
      "GET /api/agent-actions",
      "GET /api/agent-templates",
      "GET /api/agents",
      "GET /api/agents/{id}",
      "GET /api/automations",
      "GET /api/automations/{id}",
      "GET /api/destinations",
      "GET /api/destinations/{id}",
      "GET /api/integrations",
      "GET /api/integrations/capabilities",
      "GET /api/integrations/connect/status",
      "GET /api/integrations/sync-status",
      "GET /api/signals",
      "GET /api/signals/{id}",
      "POST /api/agents",
      "POST /api/agents/custom",
      "POST /api/agents/{id}/actions",
      "POST /api/agents/{id}/disable",
      "POST /api/agents/{id}/enable",
      "POST /api/agents/{id}/instructions",
      "POST /api/agents/{id}/profile",
      "POST /api/agents/{id}/rename",
      "POST /api/automations",
      "POST /api/automations/{id}",
      "POST /api/automations/{id}/archive",
      "POST /api/automations/{id}/disable",
      "POST /api/automations/{id}/enable",
      "POST /api/destinations/webhook",
      "POST /api/destinations/{id}",
      "POST /api/destinations/{id}/archive",
      "POST /api/destinations/{id}/disable",
      "POST /api/destinations/{id}/enable",
      "POST /api/integrations/connect",
      "POST /api/integrations/disconnect",
      "POST /api/integrations/setup-step",
      "POST /api/signals",
      "POST /api/signals/{id}",
      "POST /api/signals/{id}/archive",
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

  test("documents validation failures for agent rename", () => {
    const spec = readJson<{
      paths?: Record<string, any>
    }>("docs/openapi.json")
    const renameResponses = spec.paths?.["/api/agents/{id}/rename"]?.post?.responses

    expect(renameResponses?.["400"]).toMatchObject({
      description: "The request body failed command validation.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CommandErrorEnvelope" },
        },
      },
    })
  })

  test("aligns automation write request bounds with public contracts", () => {
    const spec = readJson<{
      components?: {
        schemas?: Record<string, any>
      }
    }>("docs/openapi.json")

    for (const schemaName of ["CreateAutomationRequest", "UpdateAutomationRequest"]) {
      const schema = spec.components?.schemas?.[schemaName]

      expect(schema?.properties?.triggerThresholdCount).toMatchObject({
        type: "integer",
        minimum: 2,
        maximum: 5,
      })
      expect(schema?.properties?.processorPolicy).toMatchObject({
        type: "object",
        properties: {
          subjectHandling: {
            type: "string",
            enum: ["event_customer", "scheduled_customer_pool"],
            default: "event_customer",
          },
          maxCustomersPerRun: {
            type: "integer",
            minimum: 1,
            maximum: 500,
          },
          maxConcurrentRuns: {
            type: "integer",
            const: 1,
          },
          cooldownHours: {
            type: "integer",
            minimum: 0,
            maximum: 2160,
          },
        },
        additionalProperties: false,
      })
      expect(schema?.properties?.deliveryPolicy).toMatchObject({
        type: "object",
        properties: {
          requireAllDestinations: {
            type: "boolean",
            default: false,
          },
        },
        additionalProperties: false,
        default: {
          requireAllDestinations: false,
        },
      })
      expect(schema?.properties?.audienceFilter).toEqual({
        $ref: "#/components/schemas/AutomationAudienceFilter",
      })
    }

    expect(spec.components?.schemas?.UpdateAutomationRequest?.required).toContain("enabled")
    expect(
      spec.components?.schemas?.UpdateAutomationRequest?.properties?.enabled,
    ).not.toHaveProperty("default")
    for (const updateDestinationVariant of spec.components?.schemas?.UpdateDestinationRequest
      ?.oneOf ?? []) {
      expect(updateDestinationVariant.required).toContain("enabled")
      expect(updateDestinationVariant.properties?.enabled).not.toHaveProperty("default")
    }
  })

  test("documents concrete signal definitions and automation audience filters", () => {
    const spec = readJson<{
      components?: {
        schemas?: Record<string, any>
      }
    }>("docs/openapi.json")
    const schemas = spec.components?.schemas ?? {}

    expect(schemas.CreateSignalRequest?.oneOf?.[0]?.properties?.definition).toEqual({
      $ref: "#/components/schemas/EventMatchSignalDefinition",
    })
    expect(schemas.CreateSignalRequest?.oneOf?.[1]?.properties?.definition).toEqual({
      $ref: "#/components/schemas/AuthoredSignalDefinition",
    })
    expect(schemas.UpdateSignalRequest?.oneOf?.[0]?.properties?.definition).toEqual({
      $ref: "#/components/schemas/EventMatchSignalDefinition",
    })
    expect(schemas.UpdateSignalRequest?.oneOf?.[1]?.properties?.definition).toEqual({
      $ref: "#/components/schemas/AuthoredSignalDefinition",
    })
    expect(schemas.EventMatchSignalDefinition).toMatchObject({
      type: "object",
      required: ["grain", "subjectResolver", "eventNames"],
      properties: {
        grain: {
          type: "string",
          enum: ["organization", "customer", "segment"],
        },
        subjectResolver: {
          type: "string",
          enum: ["organization", "event_customer", "segment"],
        },
        eventNames: {
          type: "array",
          minItems: 1,
          maxItems: 50,
        },
        propertyConditions: {
          type: "array",
          maxItems: 5,
        },
      },
      additionalProperties: false,
    })
    expect(schemas.EventMatchSignalDefinition.properties.grain).not.toHaveProperty("default")
    expect(schemas.EventMatchSignalDefinition.properties.subjectResolver).not.toHaveProperty(
      "default",
    )
    expect(schemas.CreateDestinationWebhookRequest?.properties?.url).toMatchObject({
      type: "string",
      format: "uri",
      pattern: expect.stringContaining("https://"),
    })
    expect(schemas.UpdateDestinationRequest?.oneOf?.[0]?.properties?.url).toMatchObject({
      type: "string",
      format: "uri",
      pattern: expect.stringContaining("localhost"),
    })
    expect(schemas.AuthoredSignalDefinition).toMatchObject({
      type: "object",
      required: ["schemaVersion", "subjectType", "detection"],
      properties: {
        schemaVersion: { type: "string", const: "2026-06-17" },
        subjectType: { type: "string", const: "customer" },
        detection: { $ref: "#/components/schemas/SignalDetection" },
      },
      additionalProperties: false,
    })
    expect(schemas.AutomationAudienceFilter).toMatchObject({
      type: "object",
      properties: {
        customer: {
          type: "object",
          properties: {
            billingStatuses: {
              type: "array",
              items: { enum: ["NONE", "TRIALING", "PAYING", "PAST_DUE", "CHURNED"] },
            },
            revenue: { $ref: "#/components/schemas/AutomationAudienceRevenueFilter" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    })
  })

  test("uses only internal OpenAPI references", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const refs = collectRefs(spec)

    expect(refs.length).toBeGreaterThan(0)
    expect(refs.every((ref) => ref.startsWith("#/"))).toBe(true)
  })
})
