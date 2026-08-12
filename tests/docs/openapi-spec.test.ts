import { existsSync, readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import {
  apiKeyValidationFailureSchema,
  apiKeyValidationSuccessSchema,
  apiKeyValidationTransport,
  ingestTransport,
  publicOpenApiTransports,
  publicToolNames,
  sdkConsumerContractHash,
  toolGatewayErrorSchema,
  toolGatewayTransport,
} from "../../packages/tools/src/generated/contracts"

type OpenApiSpec = {
  openapi: string
  security?: Array<Record<string, unknown>>
  servers?: Array<{ url: string }>
  paths?: Record<string, Record<string, unknown>>
  components?: {
    securitySchemes?: Record<string, unknown>
    schemas?: Record<string, any>
  }
  "x-outlit-contract-hash"?: string
}

type OpenApiJsonResponse = {
  content: { "application/json": { schema: Record<string, unknown> } }
}

type GatewayOperation = {
  requestBody: {
    content: {
      "application/json": {
        schema: {
          oneOf: Array<{
            required?: string[]
            properties?: { tool?: { const?: string } }
          }>
        }
      }
    }
  }
  responses: Record<string, OpenApiJsonResponse>
}

type ValidationOperation = {
  responses: Record<string, OpenApiJsonResponse>
}

function readSpec(): OpenApiSpec {
  return JSON.parse(readFileSync("docs/openapi.json", "utf8"))
}

function collectRefs(value: unknown): string[] {
  if (!value || typeof value !== "object") return []
  if (Array.isArray(value)) return value.flatMap(collectRefs)
  const record = value as Record<string, unknown>
  return [
    ...(typeof record.$ref === "string" ? [record.$ref] : []),
    ...Object.values(record).flatMap(collectRefs),
  ]
}

describe("Core-generated OpenAPI spec", () => {
  test("is registered at the docs root", () => {
    expect(existsSync("docs/openapi.json")).toBe(true)
    expect(readSpec().openapi).toMatch(/^3\./)

    const docsConfig = JSON.parse(readFileSync("docs/docs.json", "utf8")) as {
      contextual?: { options?: string[] }
      navigation?: { tabs?: Array<{ tab?: string; openapi?: string }> }
    }
    expect(docsConfig.navigation?.tabs?.find((tab) => tab.tab === "API Reference")?.openapi).toBe(
      "openapi.json",
    )
    expect(docsConfig.contextual?.options).toContain("download-spec")
  })

  test("publishes only the generated gateway, key validation, and ingest transports", () => {
    const spec = readSpec()
    expect(spec.servers).toContainEqual({ url: "https://app.outlit.ai" })
    expect(Object.keys(spec.paths ?? {}).sort()).toEqual(
      publicOpenApiTransports.map((transport) => transport.openApiPath).sort(),
    )
    for (const transport of publicOpenApiTransports) {
      expect(spec.paths?.[transport.openApiPath]?.[transport.method.toLowerCase()]).toBeDefined()
    }
    expect(
      spec.paths?.[toolGatewayTransport.path]?.[toolGatewayTransport.method.toLowerCase()],
    ).toBeDefined()
    expect(
      spec.paths?.[ingestTransport.pathTemplate]?.[ingestTransport.method.toLowerCase()],
    ).toBeDefined()
    expect(spec["x-outlit-contract-hash"]).toBe(sdkConsumerContractHash)
  })

  test("keeps gateway schemas aligned with all 36 public capabilities", () => {
    const spec = readSpec()
    const schemas = spec.components?.schemas ?? {}
    const gateway = spec.paths?.[toolGatewayTransport.path]?.post as GatewayOperation
    const callVariants = gateway.requestBody.content["application/json"].schema.oneOf
    expect(callVariants.map((variant) => variant.properties?.tool?.const)).toEqual(publicToolNames)
    for (const toolName of publicToolNames) {
      expect(schemas[`ToolInput_${toolName}`]).toBeDefined()
      expect(schemas[`ToolOutput_${toolName}`]).toBeDefined()
    }
    expect(Object.keys(schemas).filter((name) => name.startsWith("ToolInput_"))).toHaveLength(36)
  })

  test("documents immediate production for created Behavior Metrics", () => {
    const schema = readSpec().components?.schemas?.ToolOutput_outlit_create_behavior_metric as {
      properties?: {
        metric?: {
          properties?: { evaluationMode?: unknown; definitions?: unknown }
        }
      }
    }

    expect(schema.properties?.metric?.properties?.evaluationMode).toEqual({
      type: "string",
      const: "PRODUCTION",
    })
    expect(schema.properties?.metric?.properties?.definitions).toMatchObject({
      type: "object",
      required: ["activeDays", "eventCount"],
      additionalProperties: false,
      properties: {
        activeDays: { properties: { aggregation: { const: "active_days" } } },
        eventCount: { properties: { aggregation: { const: "event_count" } } },
      },
    })
  })

  test("documents the stable gateway error envelope", () => {
    const { $schema: _jsonSchemaDialect, ...openApiErrorSchema } = toolGatewayErrorSchema

    expect(readSpec().components?.schemas?.GatewayError).toEqual(openApiErrorSchema)
  })

  test("preserves runtime request, output, status, and validation semantics", () => {
    const spec = readSpec()
    const gateway = spec.paths?.[toolGatewayTransport.path]?.post as GatewayOperation
    const callVariants = gateway.requestBody.content["application/json"].schema.oneOf
    expect(callVariants.every((variant) => variant.required?.join() === "tool")).toBe(true)
    expect(gateway.responses["200"].content["application/json"].schema).toHaveProperty("anyOf")
    expect(gateway.responses["200"].content["application/json"].schema).not.toHaveProperty("oneOf")
    expect(Object.keys(gateway.responses).map(Number)).toEqual([
      200,
      ...toolGatewayTransport.errorStatuses,
    ])

    const validation = spec.paths?.[apiKeyValidationTransport.path]?.post as ValidationOperation
    expect(Object.keys(validation.responses).map(Number)).toEqual(
      apiKeyValidationTransport.publicResponseStatuses,
    )
    expect(validation.responses["401"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ApiKeyValidationFailure",
    })

    const { $schema: _successDialect, ...openApiValidationSuccess } = apiKeyValidationSuccessSchema
    const { $schema: _failureDialect, ...openApiValidationFailure } = apiKeyValidationFailureSchema
    expect(spec.components?.schemas?.ApiKeyValidationSuccess).toEqual(openApiValidationSuccess)
    expect(spec.components?.schemas?.ApiKeyValidationFailure).toEqual(openApiValidationFailure)
  })

  test("keeps ingest unauthenticated and excludes rejected stage and billing events", () => {
    const spec = readSpec()
    expect(spec.security).toEqual([{ bearerAuth: [] }])
    expect(spec.components?.securitySchemes?.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      description: "Outlit API key (ok_...).",
    })
    expect(
      (spec.paths?.[ingestTransport.pathTemplate]?.post as { security?: unknown })?.security,
    ).toEqual([])

    const ingestJson = JSON.stringify(spec.components?.schemas?.IngestPayload)
    for (const eventType of ingestTransport.eventTypes) expect(ingestJson).toContain(eventType)
    expect(ingestJson).not.toMatch(/"stage"|"billing"/)
  })

  test("uses only internal OpenAPI references", () => {
    const refs = collectRefs(readSpec())
    expect(refs.length).toBeGreaterThan(0)
    expect(refs.every((ref) => ref.startsWith("#/"))).toBe(true)
  })
})
