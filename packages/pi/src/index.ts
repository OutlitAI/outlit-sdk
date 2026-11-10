import type { AgentToolResult, ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent"
import {
  createOutlitClient,
  DEFAULT_OUTLIT_API_URL,
  defaultToolNames,
  getPublicToolContract,
  isPublicToolName,
  type OutlitToolsFetch,
  type OutlitToolsResponseInfo,
  type PiToolName,
  piToolNames,
  type ToolsetName,
  toolNamesInToolsets,
} from "@outlit/tools"
import type { TSchema } from "@sinclair/typebox"

export const OUTLIT_API_KEY_ENV = "OUTLIT_API_KEY"
export const OUTLIT_API_URL_ENV = "OUTLIT_API_URL"

const piToolNameSet = new Set<string>(piToolNames)

export type OutlitPiExtensionOptions = {
  apiKey?: string
  baseUrl?: string
  fetch?: OutlitToolsFetch
  toolNames?: readonly PiToolName[]
  /**
   * Register every tool in these Core toolsets (core, work, identity, admin, meta). With `toolNames`
   * too, both apply; with neither, the default read-only tools are registered.
   */
  toolsets?: readonly ToolsetName[]
}

export type OutlitPiRegistry = Pick<ExtensionAPI, "registerTool">

export type OutlitPiToolDetails = {
  toolName: PiToolName
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
  return resolveToolNames(options).map((toolName) => createOutlitPiTool(toolName, options))
}

export function createOutlitPiTool(
  toolName: PiToolName,
  options: OutlitPiExtensionOptions = {},
): OutlitPiToolDefinition {
  if (!isPublicToolName(toolName)) {
    throw new Error(`Unknown Outlit public tool: ${toolName}`)
  }
  if (!piToolNameSet.has(toolName)) {
    throw new Error(`Tool is not available in @outlit/pi: ${toolName}`)
  }

  const contract = getPublicToolContract(toolName)
  const label = formatOutlitToolLabel(toolName)

  return {
    name: toolName,
    label,
    description: contract.description,
    promptSnippet: `${label}: ${firstLine(contract.description)}`,
    parameters: toPiToolParameters(contract.inputSchema),
    async execute(_toolCallId, params) {
      let responseInfo: OutlitToolsResponseInfo | undefined
      const client = createOutlitClient({
        apiKey: resolveApiKey(options),
        baseUrl: resolveBaseUrl(options),
        fetch: options.fetch,
        onResponse: (info) => {
          responseInfo = info
        },
      })
      const result = await client.callTool(toolName, normalizeToolInput(params))

      return formatToolResult(toolName, result, responseInfo)
    },
  }
}

function toPiToolParameters(inputSchema: unknown): TSchema {
  if (inputSchema === null || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    return inputSchema as TSchema
  }

  const { $schema: _schema, ...schema } = inputSchema as Record<string, unknown>
  return schema as unknown as TSchema
}

export function formatOutlitToolLabel(toolName: PiToolName): string {
  return toolName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function resolveToolNames(options: OutlitPiExtensionOptions): PiToolName[] {
  const names: readonly string[] = [
    ...(options.toolNames ?? (options.toolsets ? [] : defaultToolNames)),
    ...(options.toolsets ? toolNamesInToolsets(options.toolsets) : []),
  ]

  return [...new Set(names)].map((name) => {
    if (!isPublicToolName(name)) {
      throw new Error(`Unknown Outlit public tool: ${name}`)
    }

    return name as PiToolName
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

/** What the gateway said beside the result, as sentences for the agent: a deprecation, then notices. */
function responseNotices(info: OutlitToolsResponseInfo | undefined): string[] {
  if (!info) return []
  return [
    ...(info.deprecation ? [`${info.deprecation.message} (until ${info.deprecation.until})`] : []),
    ...info.notices,
  ]
}

function formatToolResult(
  toolName: PiToolName,
  result: unknown,
  info?: OutlitToolsResponseInfo,
): AgentToolResult<OutlitPiToolDetails> {
  const notices = responseNotices(info)
  return {
    content: [
      { type: "text", text: JSON.stringify(result, null, 2) ?? String(result) },
      // After the result, so a reader of the first block still gets the JSON alone.
      ...(notices.length > 0
        ? [{ type: "text" as const, text: `Notice: ${notices.join(" ")}` }]
        : []),
    ],
    details: {
      toolName,
      result,
    },
  }
}

function firstLine(value: string): string {
  return value.split("\n", 1)[0] ?? value
}

export type { PiToolName } from "@outlit/tools"
/** @deprecated Use PiToolName. */
export type PublicToolName = PiToolName
export type { ToolsetName } from "@outlit/tools"
export {
  analyticalToolNames,
  defaultToolNames,
  piToolNames,
  piToolNames as allPublicToolNames,
  sqlToolNames,
  toolsetNames,
} from "@outlit/tools"

export default createOutlitPiExtension()
