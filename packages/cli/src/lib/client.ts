import { createOutlitClient, isCustomerToolName } from "@outlit/tools"
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

export interface PlatformCommandErrorEnvelope {
  ok: false
  commandId: string
  commandVersion: number
  error: {
    code: string
    message: string
    correlationId: string
    retryable: boolean
    details?: unknown
  }
}

export type PlatformCommandError = Error & {
  status: number
  commandEnvelope: PlatformCommandErrorEnvelope
}

// ok_ prefix + at least 32 alphanumeric/dash/underscore characters (minimum 35 chars total).
// Widened from {32} to {32,} since real API keys may be longer than 32 suffix chars.
const API_KEY_REGEX = /^ok_[A-Za-z0-9_-]{32,}$/

/** Maps CLI-owned direct API commands to Platform REST endpoints outside `/api/tools/call`. */
const CLI_TOOL_ENDPOINTS: Record<string, { method: "GET" | "POST"; path: string }> = {
  outlit_list_integrations: { method: "GET", path: "/api/integrations" },
  outlit_connect_integration: { method: "POST", path: "/api/integrations/connect" },
  outlit_connect_status: { method: "GET", path: "/api/integrations/connect/status" },
  outlit_integration_sync_status: {
    method: "GET",
    path: "/api/integrations/sync-status",
  },
  outlit_integration_capabilities: {
    method: "GET",
    path: "/api/integrations/capabilities",
  },
  outlit_integration_setup_step: {
    method: "POST",
    path: "/api/integrations/setup-step",
  },
  outlit_agent_list_templates: {
    method: "GET",
    path: "/api/agent-templates",
  },
  outlit_agent_list_available_actions: {
    method: "GET",
    path: "/api/agent-actions",
  },
  outlit_agent_create_from_template: {
    method: "POST",
    path: "/api/agents",
  },
}

export function isPlatformCommandError(error: unknown): error is PlatformCommandError {
  return (
    error instanceof Error &&
    isRecord((error as Partial<PlatformCommandError>).commandEnvelope) &&
    isCommandErrorEnvelope((error as Partial<PlatformCommandError>).commandEnvelope)
  )
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
    } else if (typeof value === "object") {
      url.searchParams.set(key, JSON.stringify(value))
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
  const toolsClient = createOutlitClient({
    apiKey: credential.key,
    baseUrl,
  })

  return {
    key: credential.key,
    baseUrl,
    async callTool(toolName: string, params: Record<string, unknown>) {
      if (isCustomerToolName(toolName)) {
        return toolsClient.callTool(toolName, params)
      }

      const endpoint = CLI_TOOL_ENDPOINTS[toolName]
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
        const payload = parseJson(text)
        if (isCommandErrorEnvelope(payload)) {
          throw createPlatformCommandError(response.status, payload)
        }
        throw new Error(`API error (${response.status}): ${text}`)
      }

      return response.json()
    },
  }
}

function createPlatformCommandError(
  status: number,
  commandEnvelope: PlatformCommandErrorEnvelope,
): PlatformCommandError {
  const error = new Error(commandEnvelope.error.message) as PlatformCommandError
  error.name = "PlatformCommandError"
  error.status = status
  error.commandEnvelope = commandEnvelope
  return error
}

function parseJson(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function isCommandErrorEnvelope(payload: unknown): payload is PlatformCommandErrorEnvelope {
  if (!isRecord(payload) || payload.ok !== false) return false
  if (typeof payload.commandId !== "string") return false
  if (typeof payload.commandVersion !== "number") return false
  if (!isRecord(payload.error)) return false

  return (
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string" &&
    typeof payload.error.correlationId === "string" &&
    typeof payload.error.retryable === "boolean"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
