import { DEFAULT_API_URL, OUTLIT_DASHBOARD_URL, resolveApiKey } from "./config"

export interface OutlitClient {
  /** The validated API key in use for this client instance */
  key: string
  /** The Platform API base URL */
  baseUrl: string
  /**
   * Call an Outlit API endpoint by tool name.
   *
   * Maps the tool name to a Platform REST endpoint and sends the request
   * with the appropriate HTTP method (GET with query params, or POST with JSON body).
   */
  callTool(toolName: string, params: Record<string, unknown>): Promise<unknown>
}

// ok_ prefix + at least 32 alphanumeric/dash/underscore characters (minimum 35 chars total).
// Widened from {32} to {32,} since real API keys may be longer than 32 suffix chars.
const API_KEY_REGEX = /^ok_[A-Za-z0-9_-]{32,}$/

/** Maps CLI tool names to Platform REST endpoints. */
const TOOL_ENDPOINTS: Record<string, { method: "GET" | "POST"; path: string }> = {
  outlit_list_customers: { method: "GET", path: "/api/internal/mcp/customers" },
  outlit_get_customer: { method: "POST", path: "/api/internal/mcp/customers" },
  outlit_list_users: { method: "GET", path: "/api/internal/mcp/users" },
  outlit_get_timeline: { method: "POST", path: "/api/internal/mcp/timeline" },
  outlit_get_facts: { method: "POST", path: "/api/internal/mcp/facts" },
  outlit_schema: { method: "GET", path: "/api/internal/mcp/sql-schema" },
  outlit_query: { method: "POST", path: "/api/internal/mcp/sql" },
  outlit_search_customer_context: { method: "POST", path: "/api/internal/mcp/context-search" },
}

/**
 * Builds a URL with query parameters from a params object.
 * Skips null/undefined values. Arrays are joined with commas.
 */
function buildUrl(base: string, path: string, params: Record<string, unknown>): string {
  const url = new URL(path, base)
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      url.searchParams.set(key, value.join(","))
    } else {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * Create an authenticated Platform API client.
 *
 * Resolves the API key from (in priority order):
 * 1. flagApiKey argument (--api-key flag)
 * 2. OUTLIT_API_KEY environment variable
 * 3. ~/.config/outlit/credentials.json (written by `outlit auth login`)
 *
 * Throws if no key is found or the key format is invalid.
 *
 * Uses OUTLIT_API_URL to override the Platform base URL (for local dev/staging).
 */
export async function createClient(flagApiKey?: string): Promise<OutlitClient> {
  const credential = resolveApiKey(flagApiKey)

  if (!credential) {
    throw new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY.")
  }

  if (!API_KEY_REGEX.test(credential.key)) {
    throw new Error(
      `Invalid API key format. Keys must start with "ok_" followed by at least 32 alphanumeric characters. Get one at ${OUTLIT_DASHBOARD_URL}`,
    )
  }

  const baseUrl = process.env.OUTLIT_API_URL ?? DEFAULT_API_URL

  return {
    key: credential.key,
    baseUrl,
    async callTool(toolName: string, params: Record<string, unknown>) {
      const endpoint = TOOL_ENDPOINTS[toolName]
      if (!endpoint) {
        throw new Error(`Unknown tool: ${toolName}`)
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${credential.key}`,
      }

      let url: string
      let body: string | undefined

      if (endpoint.method === "GET") {
        url = buildUrl(baseUrl, endpoint.path, params)
      } else {
        url = new URL(endpoint.path, baseUrl).toString()
        headers["Content-Type"] = "application/json"
        body = JSON.stringify(params)
      }

      const response = await globalThis.fetch(url, {
        method: endpoint.method,
        headers,
        body,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API error (${response.status}): ${text}`)
      }

      return response.json()
    },
  }
}
