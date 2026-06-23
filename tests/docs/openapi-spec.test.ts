import { existsSync, readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import { allCustomerToolNames } from "../../packages/tools/src/toolsets.js"

type OpenApiSpec = {
  openapi: string
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
      "/api/i/v1/{publicKey}/events",
      "/api/integrations",
      "/api/integrations/capabilities",
      "/api/integrations/connect",
      "/api/integrations/connect/status",
      "/api/integrations/setup-step",
      "/api/integrations/sync-status",
      "/api/tools/call",
      "/api/validate-api-key",
    ])
  })

  test("applies bearer auth only to Platform API operations", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const bearerAuth = spec.components?.securitySchemes?.bearerAuth

    expect(bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      description: "Outlit API key using the Bearer ok_... format.",
    })

    const paths = spec.paths ?? {}
    expect(paths["/api/validate-api-key"]?.post).toMatchObject({
      security: [{ bearerAuth: [] }],
    })
    expect(paths["/api/tools/call"]?.post).toMatchObject({
      security: [{ bearerAuth: [] }],
    })
    expect(paths["/api/integrations"]?.get).toMatchObject({
      security: [{ bearerAuth: [] }],
    })
    expect(paths["/api/i/v1/{publicKey}/events"]?.post).toMatchObject({
      security: [],
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

  test("uses only internal OpenAPI references", () => {
    const spec = readJson<OpenApiSpec>("docs/openapi.json")
    const refs = collectRefs(spec)

    expect(refs.length).toBeGreaterThan(0)
    expect(refs.every((ref) => ref.startsWith("#/"))).toBe(true)
  })
})
