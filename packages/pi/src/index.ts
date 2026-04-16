import type { AgentToolResult, ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent"
import {
  type CustomerToolName,
  createOutlitClient,
  DEFAULT_OUTLIT_API_URL,
  defaultAgentToolNames,
  getCustomerToolContract,
  isCustomerToolName,
  type OutlitToolsFetch,
} from "@outlit/tools"
import type { TSchema } from "@sinclair/typebox"

export const OUTLIT_API_KEY_ENV = "OUTLIT_API_KEY"
export const OUTLIT_API_URL_ENV = "OUTLIT_API_URL"

export type OutlitPiExtensionOptions = {
  apiKey?: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
  toolNames?: readonly CustomerToolName[]
}

export type OutlitPiRegistry = Pick<ExtensionAPI, "registerTool">

export type OutlitPiToolDetails = {
  toolName: CustomerToolName
  result: unknown
}

export type OutlitPiToolDefinition = ToolDefinition<TSchema, OutlitPiToolDetails>

export function createOutlitPiExtension(options: OutlitPiExtensionOptions = {}) {
  return function outlitPiExtension(pi: OutlitPiRegistry) {
    for (const tool of createOutlitPiTools(options)) {
      pi.registerTool(tool)
    }
  }
}

export function createOutlitPiTools(
  options: OutlitPiExtensionOptions = {},
): OutlitPiToolDefinition[] {
  return resolveToolNames(options.toolNames).map((toolName) =>
    createOutlitPiTool(toolName, options),
  )
}

export function createOutlitPiTool(
  toolName: CustomerToolName,
  options: OutlitPiExtensionOptions = {},
): OutlitPiToolDefinition {
  const contract = getCustomerToolContract(toolName)
  const label = formatOutlitToolLabel(toolName)

  return {
    name: toolName,
    label,
    description: contract.description,
    promptSnippet: `${label}: ${firstLine(contract.description)}`,
    parameters: contract.inputSchema as unknown as TSchema,
    async execute(_toolCallId, params) {
      const client = createOutlitClient({
        apiKey: resolveApiKey(options),
        baseUrl: resolveBaseUrl(options),
        fetch: options.fetch,
      })
      const result = await client.callTool(toolName, normalizeToolInput(params))

      return formatToolResult(toolName, result)
    },
  }
}

export function formatOutlitToolLabel(toolName: CustomerToolName): string {
  return toolName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function resolveToolNames(toolNames: readonly CustomerToolName[] | undefined): CustomerToolName[] {
  const names = toolNames ?? defaultAgentToolNames

  return [...new Set(names)].map((name) => {
    if (!isCustomerToolName(name)) {
      throw new Error(`Unknown Outlit customer tool: ${name}`)
    }

    return name
  })
}

function resolveApiKey(options: OutlitPiExtensionOptions): string {
  const apiKey = normalizeString(options.apiKey) ?? normalizeString(process.env[OUTLIT_API_KEY_ENV])

  if (!apiKey) {
    throw new Error(`${OUTLIT_API_KEY_ENV} is required to use @outlit/pi tools`)
  }

  return apiKey
}

function resolveBaseUrl(options: OutlitPiExtensionOptions): string {
  return (
    normalizeString(options.baseUrl) ??
    normalizeString(process.env[OUTLIT_API_URL_ENV]) ??
    DEFAULT_OUTLIT_API_URL
  )
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeToolInput(params: unknown): Record<string, unknown> {
  if (params === undefined) {
    return {}
  }

  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    throw new TypeError("Outlit Pi tool input must be an object")
  }

  return params as Record<string, unknown>
}

function formatToolResult(
  toolName: CustomerToolName,
  result: unknown,
): AgentToolResult<OutlitPiToolDetails> {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) ?? String(result) }],
    details: {
      toolName,
      result,
    },
  }
}

function firstLine(value: string): string {
  return value.split("\n", 1)[0] ?? value
}

export type { CustomerToolName } from "@outlit/tools"
export {
  actionToolNames,
  allCustomerToolNames,
  analyticalAgentToolNames,
  defaultAgentToolNames,
  sqlToolNames,
} from "@outlit/tools"

export default createOutlitPiExtension()
