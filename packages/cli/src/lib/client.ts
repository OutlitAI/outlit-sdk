import {
  type CliToolName,
  cliToolNames,
  createOutlitClient,
  isPublicToolName,
  type PublicToolName,
} from "@outlit/tools"
import type { ActivationPreviewInput, ActivationUpdateInput } from "./activation"
import { DEFAULT_API_URL, OUTLIT_DASHBOARD_URL, resolveApiKey } from "./config"

export type OutlitToolParams<TToolName extends CliToolName> =
  TToolName extends "outlit_get_customer_activation"
    ? Record<string, never>
    : TToolName extends "outlit_preview_customer_activation"
      ? ActivationPreviewInput
      : TToolName extends "outlit_update_customer_activation"
        ? ActivationUpdateInput
        : Record<string, unknown>

export interface OutlitClient {
  key: string
  baseUrl: string
  callTool<TToolName extends CliToolName>(
    toolName: TToolName,
    params: OutlitToolParams<TToolName>,
  ): Promise<unknown>
}

const API_KEY_REGEX = /^ok_[A-Za-z0-9_-]{32,}$/
const cliToolNameSet = new Set<string>(cliToolNames)

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
  validateApiBaseUrl(baseUrl)
  const toolsClient = createOutlitClient({ apiKey: credential.key, baseUrl })

  return {
    key: credential.key,
    baseUrl,
    async callTool<TToolName extends CliToolName>(
      toolName: TToolName,
      params: OutlitToolParams<TToolName>,
    ): Promise<unknown> {
      if (!isPublicToolName(toolName) || !cliToolNameSet.has(toolName)) {
        throw new Error(`Unknown CLI tool: ${toolName}`)
      }
      return toolsClient.callTool(toolName as PublicToolName, params as Record<string, unknown>)
    },
  }
}

export function validateApiBaseUrl(baseUrl: string): void {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error("OUTLIT_API_URL must be a valid absolute URL")
  }

  if (url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    return
  }

  throw new Error("OUTLIT_API_URL must use HTTPS unless it is a loopback development URL")
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return (
    normalized === "localhost" || normalized === "::1" || /^127(?:\.\d{1,3}){3}$/.test(normalized)
  )
}
