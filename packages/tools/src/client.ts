import { isPublicToolName, type PublicToolName } from "./contracts.js"
import {
  toolGatewayErrorCodes,
  toolGatewayErrorSchema,
  toolGatewayTransport,
} from "./generated/contracts.js"
import type { JsonSchemaValue, PublicToolResult } from "./results.js"

export const DEFAULT_OUTLIT_API_URL = "https://app.outlit.ai"

export type OutlitToolsFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type OutlitToolsClientOptions = {
  apiKey: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
}

type ToolGatewayErrorProperties = typeof toolGatewayErrorSchema.properties
type ToolGatewayErrorRequiredProperty = (typeof toolGatewayErrorSchema.required)[number]
type ToolGatewayErrorOptionalProperty = Exclude<
  keyof ToolGatewayErrorProperties,
  ToolGatewayErrorRequiredProperty
>

export type ToolGatewayErrorCode = (typeof toolGatewayErrorCodes)[number]
export type ToolGatewayErrorEnvelope = {
  [TKey in ToolGatewayErrorRequiredProperty]: JsonSchemaValue<ToolGatewayErrorProperties[TKey]>
} & {
  [TKey in ToolGatewayErrorOptionalProperty]?: JsonSchemaValue<ToolGatewayErrorProperties[TKey]>
}

export class OutlitToolsApiError extends Error {
  readonly status: number
  readonly envelope?: ToolGatewayErrorEnvelope

  constructor(status: number, responseText: string, envelope?: ToolGatewayErrorEnvelope) {
    super(envelope?.message ?? `API error (${status}): ${responseText}`)
    this.name = "OutlitToolsApiError"
    this.status = status
    this.envelope = envelope
  }
}

export function isOutlitToolsApiError(error: unknown): error is OutlitToolsApiError {
  return error instanceof OutlitToolsApiError
}

export type OutlitToolsClient = {
  key: string
  baseUrl: string
  callTool<TToolName extends PublicToolName>(
    toolName: TToolName,
    input?: Record<string, unknown>,
  ): Promise<PublicToolResult<TToolName>>
}

export function createOutlitClient(options: OutlitToolsClientOptions): OutlitToolsClient {
  const key = options.apiKey.trim()
  const baseUrl = options.baseUrl ?? DEFAULT_OUTLIT_API_URL
  const fetchImpl = options.fetch ?? globalThis.fetch

  if (!key) {
    throw new Error("apiKey is required")
  }

  if (!fetchImpl) {
    throw new Error("fetch is not available")
  }

  return {
    key,
    baseUrl,
    async callTool<TToolName extends PublicToolName>(
      toolName: TToolName,
      input: Record<string, unknown> = {},
    ): Promise<PublicToolResult<TToolName>> {
      if (!isPublicToolName(toolName)) {
        throw new Error(`Unknown public tool: ${toolName}`)
      }

      const response = await fetchImpl(new URL(toolGatewayTransport.path, baseUrl).toString(), {
        method: toolGatewayTransport.method,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: toolName,
          input,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new OutlitToolsApiError(response.status, text, parseGatewayError(text))
      }

      return (await response.json()) as PublicToolResult<TToolName>
    },
  }
}

function parseGatewayError(text: string): ToolGatewayErrorEnvelope | undefined {
  try {
    const value = JSON.parse(text) as unknown
    if (matchesGeneratedJsonSchema(value, toolGatewayErrorSchema)) {
      return value as ToolGatewayErrorEnvelope
    }
  } catch {
    // Non-JSON failures retain the status and raw response text.
  }
  return undefined
}

export type RuntimeJsonSchema = {
  readonly type?: string
  readonly const?: unknown
  readonly enum?: readonly unknown[]
  readonly anyOf?: readonly RuntimeJsonSchema[]
  readonly oneOf?: readonly RuntimeJsonSchema[]
  readonly items?: RuntimeJsonSchema
  readonly properties?: Readonly<Record<string, RuntimeJsonSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties?: boolean | RuntimeJsonSchema
}

export function matchesGeneratedJsonSchema<TSchema extends RuntimeJsonSchema>(
  value: unknown,
  schema: TSchema,
): value is JsonSchemaValue<TSchema> {
  if (Object.hasOwn(schema, "const") && !Object.is(schema.const, value)) {
    return false
  }
  if (schema.anyOf && !schema.anyOf.some((option) => matchesGeneratedJsonSchema(value, option))) {
    return false
  }
  if (
    schema.oneOf &&
    schema.oneOf.filter((option) => matchesGeneratedJsonSchema(value, option)).length !== 1
  ) {
    return false
  }
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    return false
  }

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false

      const record = value as Record<string, unknown>
      const properties = schema.properties ?? {}
      if (schema.required?.some((property) => !Object.hasOwn(record, property))) return false
      if (
        schema.additionalProperties === false &&
        Object.keys(record).some((property) => !Object.hasOwn(properties, property))
      ) {
        return false
      }
      return Object.entries(record).every(([property, propertyValue]) => {
        const propertySchema = properties[property]
        if (propertySchema) return matchesGeneratedJsonSchema(propertyValue, propertySchema)
        if (
          typeof schema.additionalProperties === "object" &&
          schema.additionalProperties !== null
        ) {
          return matchesGeneratedJsonSchema(propertyValue, schema.additionalProperties)
        }
        return true
      })
    }
    case "array": {
      if (!Array.isArray(value)) return false
      const itemSchema = schema.items
      return !itemSchema || value.every((item) => matchesGeneratedJsonSchema(item, itemSchema))
    }
    case "string":
      return typeof value === "string"
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return typeof value === "number" && Number.isFinite(value)
    case "integer":
      return typeof value === "number" && Number.isSafeInteger(value)
    case "null":
      return value === null
    case undefined:
      return true
    default:
      return false
  }
}
