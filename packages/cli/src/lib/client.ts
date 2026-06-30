import { createOutlitClient, isCustomerToolName } from "@outlit/tools"
import { DEFAULT_API_URL, OUTLIT_DASHBOARD_URL, resolveApiKey } from "./config"
import {
  createPlatformCommandError,
  isCommandErrorEnvelope,
  isPlatformCommandError,
  type PlatformCommandError,
  type PlatformCommandErrorEnvelope,
} from "./platform-command-error"

export { isPlatformCommandError }
export type { PlatformCommandError, PlatformCommandErrorEnvelope }

export interface OutlitClient {
  /** The validated API key in use for this client instance */
  key: string
  /** The Platform API base URL */
  baseUrl: string
  /**
   * Call an Outlit API endpoint by tool name.
   *
   * Maps the tool name to a Platform REST endpoint and sends the request
   * with the appropriate HTTP method (GET with query params, or JSON body for mutations).
   */
  callTool(toolName: string, params: Record<string, unknown>): Promise<unknown>
}

// ok_ prefix + at least 32 alphanumeric/dash/underscore characters (minimum 35 chars total).
// Widened from {32} to {32,} since real API keys may be longer than 32 suffix chars.
const API_KEY_REGEX = /^ok_[A-Za-z0-9_-]{32,}$/

/** Maps CLI-owned direct API commands to Platform REST endpoints outside `/api/tools/call`. */
const CLI_TOOL_ENDPOINTS: Record<string, { method: "GET" | "POST" | "PATCH"; path: string }> = {
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
  outlit_agent_list: {
    method: "GET",
    path: "/api/agents",
  },
  outlit_agent_get: {
    method: "GET",
    path: "/api/agents/{id}",
  },
  outlit_agent_create: {
    method: "POST",
    path: "/api/agents",
  },
  outlit_agent_update: {
    method: "PATCH",
    path: "/api/agents/{id}",
  },
  outlit_agent_enable: {
    method: "POST",
    path: "/api/agents/{id}/enable",
  },
  outlit_agent_disable: {
    method: "POST",
    path: "/api/agents/{id}/disable",
  },
  outlit_agent_rename: {
    method: "POST",
    path: "/api/agents/{id}/rename",
  },
  outlit_agent_run_start: {
    method: "POST",
    path: "/api/agents/{agentId}/runs",
  },
  outlit_agent_run_list: {
    method: "GET",
    path: "/api/agents/{agentId}/runs",
  },
  outlit_agent_run_get: {
    method: "GET",
    path: "/api/agents/{agentId}/runs/{runId}",
  },
  outlit_automation_list: {
    method: "GET",
    path: "/api/automations",
  },
  outlit_automation_get: {
    method: "GET",
    path: "/api/automations/{id}",
  },
  outlit_automation_create: {
    method: "POST",
    path: "/api/automations",
  },
  outlit_automation_update: {
    method: "PATCH",
    path: "/api/automations/{id}",
  },
  outlit_automation_enable: {
    method: "POST",
    path: "/api/automations/{id}/enable",
  },
  outlit_automation_disable: {
    method: "POST",
    path: "/api/automations/{id}/disable",
  },
  outlit_automation_archive: {
    method: "POST",
    path: "/api/automations/{id}/archive",
  },
  outlit_automation_options: {
    method: "GET",
    path: "/api/automations/options",
  },
  outlit_signal_list: {
    method: "GET",
    path: "/api/signals",
  },
  outlit_signal_get: {
    method: "GET",
    path: "/api/signals/{id}",
  },
  outlit_signal_create: {
    method: "POST",
    path: "/api/signals",
  },
  outlit_signal_update: {
    method: "PATCH",
    path: "/api/signals/{id}",
  },
  outlit_signal_archive: {
    method: "POST",
    path: "/api/signals/{id}/archive",
  },
  outlit_signal_options: {
    method: "GET",
    path: "/api/signals/options",
  },
  outlit_destination_list: {
    method: "GET",
    path: "/api/destinations",
  },
  outlit_destination_get: {
    method: "GET",
    path: "/api/destinations/{id}",
  },
  outlit_destination_create: {
    method: "POST",
    path: "/api/destinations",
  },
  outlit_destination_update: {
    method: "PATCH",
    path: "/api/destinations/{id}",
  },
  outlit_destination_enable: {
    method: "POST",
    path: "/api/destinations/{id}/enable",
  },
  outlit_destination_disable: {
    method: "POST",
    path: "/api/destinations/{id}/disable",
  },
  outlit_destination_archive: {
    method: "POST",
    path: "/api/destinations/{id}/archive",
  },
  outlit_destination_options: {
    method: "GET",
    path: "/api/destinations/options",
  },
}

function resolvePathParams(
  path: string,
  params: Record<string, unknown>,
): { path: string; rest: Record<string, unknown> } {
  const rest = { ...params }
  const resolvedPath = path.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = rest[key]
    if (value == null) {
      return match
    }
    delete rest[key]
    return encodeURIComponent(String(value))
  })

  return { path: resolvedPath, rest }
}

/**
 * Builds a URL with query parameters from a params object.
 * Skips null/undefined values. Arrays are joined with commas.
 */
function buildUrl(base: string, path: string, params: Record<string, unknown>): string {
  const { path: resolvedPath, rest } = resolvePathParams(path, params)
  const url = new URL(resolvedPath, base)
  for (const [key, value] of Object.entries(rest)) {
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
        const resolved = resolvePathParams(endpoint.path, params)
        url = new URL(resolved.path, baseUrl).toString()
        headers["Content-Type"] = "application/json"
        body = JSON.stringify(resolved.rest)
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

function parseJson(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
