import { isPublicToolName, type PublicToolName } from "./contracts.js"
import {
  toolGatewayErrorCodes,
  toolGatewayErrorSchema,
  toolGatewayTransport,
} from "./generated/contracts.js"
import type { JsonSchemaValue, PublicToolResult } from "./results.js"

const toolDeprecationHeader = "outlit-deprecation"
const toolNoticeHeader = "outlit-notice"
const toolReplayedHeader = "idempotent-replayed"

export const DEFAULT_OUTLIT_API_URL = "https://app.outlit.ai"

export type OutlitToolsFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

/**
 * What the gateway said about a call beside its result. Core sends a deprecation when the call used a
 * retired tool name (`outlit-deprecation`, with `Deprecation` and `Sunset`), notices when it changed an
 * old input spelling (`outlit-notice`, for example a limit clamped to the maximum), and marks a result
 * it stored for a repeated request id (`idempotent-replayed`).
 */
export type OutlitToolsResponseInfo = {
  tool: PublicToolName
  status: number
  /** Set when the call used a retired tool name: the tool to use and the last day the name works. */
  deprecation?: { tool: string; use: string; until: string; message: string }
  /** Core's `Sunset` header as sent (an HTTP date), when present. */
  sunset?: string
  /** What the gateway changed in the input, one sentence each. */
  notices: string[]
  /** True when the result was stored from an earlier call with the same request id. */
  replayed: boolean
}

export type OutlitToolsClientOptions = {
  apiKey: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
  /** Called after every response with its deprecation, notices and replay marker. */
  onResponse?: (info: OutlitToolsResponseInfo) => void
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
    options?: { signal?: AbortSignal },
  ): Promise<PublicToolResult<TToolName>>
}

export function createOutlitClient(options: OutlitToolsClientOptions): OutlitToolsClient {
  const key = options.apiKey.trim()
  const baseUrl = options.baseUrl ?? DEFAULT_OUTLIT_API_URL
  const fetchImpl = options.fetch ?? globalThis.fetch
  const onResponse = options.onResponse

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
      callOptions?: { signal?: AbortSignal },
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
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      })

      if (onResponse) {
        try {
          onResponse(readResponseInfo(toolName, response))
        } catch {
          // A reporting hook must not turn a received result into a failure.
        }
      }

      if (!response.ok) {
        const text = await response.text()
        throw new OutlitToolsApiError(response.status, text, parseGatewayError(text))
      }

      return (await response.json()) as PublicToolResult<TToolName>
    },
  }
}

function readResponseInfo(tool: PublicToolName, response: Response): OutlitToolsResponseInfo {
  const info: OutlitToolsResponseInfo = {
    tool,
    status: response.status,
    notices: parseNoticeHeader(response.headers.get(toolNoticeHeader)),
    replayed: response.headers.get(toolReplayedHeader) === "true",
  }
  const deprecation = parseDeprecationHeader(response.headers.get(toolDeprecationHeader))
  if (deprecation) info.deprecation = deprecation
  const sunset = response.headers.get("sunset")
  if (sunset) info.sunset = sunset
  return info
}

function parseDeprecationHeader(value: string | null): OutlitToolsResponseInfo["deprecation"] {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (
      typeof parsed.tool === "string" &&
      typeof parsed.use === "string" &&
      typeof parsed.until === "string" &&
      typeof parsed.message === "string"
    ) {
      return { tool: parsed.tool, use: parsed.use, until: parsed.until, message: parsed.message }
    }
  } catch {
    // Not JSON: nothing to report beyond the Sunset header.
  }
  return undefined
}

function parseNoticeHeader(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((notice): notice is string => typeof notice === "string")
    }
  } catch {
    // A plain sentence is still a notice.
    return [value]
  }
  return []
}

function parseGatewayError(text: string): ToolGatewayErrorEnvelope | undefined {
  try {
    const value = withoutUnknownEnvelopeFields(JSON.parse(text) as unknown)
    if (
      matchesGeneratedJsonSchema(value, toolGatewayErrorSchema) &&
      // The generated schema can't carry Core's per-code rule for this field.
      (value.missingPermission === undefined || value.code === "TOOL_CALL_FORBIDDEN")
    ) {
      return value as ToolGatewayErrorEnvelope
    }
  } catch {
    // Non-JSON failures retain the status and raw response text.
  }
  return undefined
}

// A newer gateway may add envelope fields this build doesn't know. Drop them
// rather than the whole envelope, so the code and retryable still reach the caller.
function withoutUnknownEnvelopeFields(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  return Object.fromEntries(
    Object.entries(value).filter(([property]) =>
      Object.hasOwn(toolGatewayErrorSchema.properties, property),
    ),
  )
}

export type RuntimeJsonSchema = {
  // A schema with only a description accepts any value (CRM field values do); naming the
  // annotation keeps such a schema assignable instead of a weak type with no properties in common.
  readonly description?: string
  readonly type?: string
  readonly const?: unknown
  readonly enum?: readonly unknown[]
  readonly anyOf?: readonly RuntimeJsonSchema[]
  readonly oneOf?: readonly RuntimeJsonSchema[]
  readonly items?: RuntimeJsonSchema
  readonly properties?: Readonly<Record<string, RuntimeJsonSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties?: boolean | RuntimeJsonSchema
  readonly minLength?: number
  readonly maxLength?: number
  readonly pattern?: string
  readonly minItems?: number
  readonly maxItems?: number
  readonly minimum?: number
  readonly maximum?: number
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
      if (schema.minItems !== undefined && value.length < schema.minItems) return false
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return false
      const itemSchema = schema.items
      return !itemSchema || value.every((item) => matchesGeneratedJsonSchema(item, itemSchema))
    }
    case "string": {
      if (typeof value !== "string") return false
      if (schema.minLength !== undefined && value.length < schema.minLength) return false
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return false
      return schema.pattern === undefined || new RegExp(schema.pattern).test(value)
    }
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return matchesNumberBounds(value, schema, false)
    case "integer":
      return matchesNumberBounds(value, schema, true)
    case "null":
      return value === null
    case undefined:
      return true
    default:
      return false
  }
}

function matchesNumberBounds(
  value: unknown,
  schema: RuntimeJsonSchema,
  integer: boolean,
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false
  if (integer && !Number.isSafeInteger(value)) return false
  if (schema.minimum !== undefined && value < schema.minimum) return false
  if (schema.maximum !== undefined && value > schema.maximum) return false
  return true
}
