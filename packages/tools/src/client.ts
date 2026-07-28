import { type CustomerToolName, isCustomerToolName } from "./contracts.js"
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

export type CustomerToolResult<TToolName extends CustomerToolName> =
  TToolName extends "outlit_list_customers"
    ? CustomerListResult
    : TToolName extends "outlit_get_customer"
      ? CustomerDetailResult
      : unknown

export type OutlitToolsClient = {
  key: string
  baseUrl: string
  callTool<TToolName extends CustomerToolName>(
    toolName: TToolName,
    input?: Record<string, unknown>,
  ): Promise<CustomerToolResult<TToolName>>
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
    async callTool<TToolName extends CustomerToolName>(
      toolName: TToolName,
      input: Record<string, unknown> = {},
    ): Promise<CustomerToolResult<TToolName>> {
      if (!isCustomerToolName(toolName)) {
        throw new Error(`Unknown customer tool: ${toolName}`)
      }

      const response = await fetchImpl(new URL("/api/tools/call", baseUrl).toString(), {
        method: "POST",
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
        throw new Error(`API error (${response.status}): ${text}`)
      }

      return (await response.json()) as CustomerToolResult<TToolName>
    },
  }
}
