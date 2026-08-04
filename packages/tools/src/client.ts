import { isPublicToolName, type PublicToolName } from "./contracts.js"
import { toolGatewayTransport } from "./generated/contracts.js"
import type { CustomerDetailResult, CustomerListResult } from "./results.js"

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

export type ToolGatewayErrorEnvelope = {
  code: string
  message: string
  retryable: boolean
  requestId: string
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

export type PublicToolResult<TToolName extends PublicToolName> =
  TToolName extends "outlit_list_customers"
    ? CustomerListResult
    : TToolName extends "outlit_get_customer"
      ? CustomerDetailResult
      : unknown

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
    const value = JSON.parse(text) as Partial<ToolGatewayErrorEnvelope>
    if (
      typeof value.code === "string" &&
      typeof value.message === "string" &&
      typeof value.retryable === "boolean" &&
      typeof value.requestId === "string"
    ) {
      return value as ToolGatewayErrorEnvelope
    }
  } catch {
    // Non-JSON failures retain the status and raw response text.
  }
  return undefined
}
