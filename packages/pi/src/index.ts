import type { AgentToolResult, ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent"
import {
  createOutlitClient,
  DEFAULT_OUTLIT_API_URL,
  defaultToolNames,
  getPublicToolContract,
  isOutlitToolsApiError,
  isPublicToolName,
  type OutlitToolsFetch,
  type OutlitToolsResponseInfo,
  type PiToolName,
  piToolNames,
  type ToolGatewayErrorEnvelope,
  type ToolsetName,
  toolNamesInToolsets,
} from "@outlit/tools"
import type { TSchema } from "@sinclair/typebox"
import pkg from "../package.json" with { type: "json" }

export const OUTLIT_API_KEY_ENV = "OUTLIT_API_KEY"
export const OUTLIT_API_URL_ENV = "OUTLIT_API_URL"

/** Sent as `x-outlit-client`, so Core can tell a Pi extension below a release's minimum version. */
export const OUTLIT_PI_CLIENT = `@outlit/pi/${pkg.version}`

const piToolNameSet = new Set<string>(piToolNames)

/**
 * What the extension registers with no options: Core's default customer intelligence tools, plus the
 * two read-only toolset tools, so an agent that needs a tool outside this list can find out which
 * toolset holds it and tell the user to enable it (the `toolsets` option below). Pi registers tools
 * when the session starts, so loading a toolset never adds callable tools mid-session.
 */
export const piDefaultToolNames: readonly PiToolName[] = [
  ...defaultToolNames,
  "outlit_list_toolsets",
  "outlit_load_toolset",
]

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

/**
 * What a failed call hands the agent: the gateway's whole error envelope (`code`, `message`,
 * `retryable`, `requestId`, and when present `next`, `missingPermission`, `validationIssues`,
 * `retryAfterSeconds`), plus the HTTP `status` when there was a response. A failure with no envelope
 * (a proxy's HTML error page, a dropped connection) carries a `message` and `retryable` only.
 */
export type OutlitPiToolError = Partial<ToolGatewayErrorEnvelope> & {
  message: string
  retryable: boolean
  status?: number
}

export type OutlitPiToolDetails = {
  toolName: PiToolName
  /** The tool's result; `{ error }` when the call failed (see `error`). */
  result: unknown
  /** Set when the call failed at the gateway or the network; the agent sees it as the tool result. */
  error?: OutlitPiToolError
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
        client: OUTLIT_PI_CLIENT,
        onResponse: (info) => {
          responseInfo = info
        },
      })
      const input = normalizeToolInput(params)
      try {
        const result = await client.callTool(toolName, input)
        return formatToolResult(toolName, result, responseInfo)
      } catch (error) {
        // A failed call is something the agent can act on, not a crash: hand it the envelope.
        return formatToolError(toolName, toToolError(error), responseNotices(responseInfo))
      }
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
    ...(options.toolNames ?? (options.toolsets ? [] : piDefaultToolNames)),
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

function toToolError(error: unknown): OutlitPiToolError {
  if (isOutlitToolsApiError(error)) {
    if (error.envelope) return { ...error.envelope, status: error.status }
    return {
      message: error.message,
      retryable: error.status === 429 || error.status >= 500,
      status: error.status,
    }
  }
  // fetch rejecting (offline, DNS, reset) or a 200 whose body was not JSON.
  return { message: error instanceof Error ? error.message : String(error), retryable: true }
}

function formatToolError(
  toolName: PiToolName,
  error: OutlitPiToolError,
  notices: string[],
): AgentToolResult<OutlitPiToolDetails> {
  const result = { error }
  return {
    content: [
      { type: "text", text: JSON.stringify(result, null, 2) },
      ...(notices.length > 0
        ? [{ type: "text" as const, text: `Notice: ${notices.join(" ")}` }]
        : []),
    ],
    details: { toolName, result, error },
  }
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
