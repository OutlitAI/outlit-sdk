import {
  type ApiKeyValidationSuccess,
  apiKeyValidationFailureSchema,
  apiKeyValidationSuccessSchema,
  apiKeyValidationTransport,
  type CliToolName,
  isOutlitToolsApiError,
  matchesGeneratedJsonSchema,
} from "@outlit/tools"
import type { OutlitClient, OutlitToolParams } from "./client"
import { createClient } from "./client"
import { DEFAULT_API_URL } from "./config"
import { errorMessage, isJsonMode, outputError, outputResult } from "./output"
import { createSpinner } from "./spinner"
import { renderPaginationHint, renderTable } from "./table"

export interface TableColumn {
  header: string
  key: string
  format?: (value: unknown) => string
}

export interface RunToolOptions {
  /** Column definitions for TTY table rendering. */
  table?: {
    columns: TableColumn[]
    /** Dot-separated key path to the items array in the response (default: "items"). */
    itemsKey?: string
    /** Dot-separated key path to pagination metadata in the response (default: "pagination"). */
    paginationKey?: string
  }
  /** Spinner message shown during the API call (TTY only). */
  spinnerMessage?: string
  /** Optional response normalization before JSON/table output. */
  transform?: (data: unknown) => unknown
}

export type ApiKeyValidationPayload = ApiKeyValidationSuccess

export class ApiKeyValidationUnavailableError extends Error {
  readonly status = 503

  constructor(message = "API key validation is temporarily unavailable") {
    super(message)
    this.name = "ApiKeyValidationUnavailableError"
  }
}

export function isApiKeyValidationUnavailableError(
  error: unknown,
): error is ApiKeyValidationUnavailableError {
  return error instanceof ApiKeyValidationUnavailableError
}

/**
 * Creates an authenticated API client, or exits with auth_required on failure.
 */
export async function getClientOrExit(
  flagApiKey: string | undefined,
  json: boolean,
): Promise<OutlitClient> {
  return createClient(flagApiKey).catch((err: unknown) =>
    outputError(
      { message: errorMessage(err, "Authentication failed"), code: "auth_required" },
      json,
    ),
  )
}

/**
 * Makes a lightweight validation ping against the API.
 * Throws on failure — callers decide how to handle the error.
 */
export async function pingApiKey(apiKey: string): Promise<ApiKeyValidationPayload> {
  const baseUrl = process.env.OUTLIT_API_URL ?? DEFAULT_API_URL
  const url = new URL(apiKeyValidationTransport.path, baseUrl).toString()

  const response = await globalThis.fetch(url, {
    method: apiKeyValidationTransport.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  const text = await response.text()
  const payload: unknown =
    text.length > 0
      ? (() => {
          try {
            return JSON.parse(text) as unknown
          } catch {
            return null
          }
        })()
      : null

  if (response.status === apiKeyValidationTransport.responseStatuses.unavailable) {
    const message = matchesGeneratedJsonSchema(payload, apiKeyValidationFailureSchema)
      ? payload.error
      : undefined
    throw new ApiKeyValidationUnavailableError(message)
  }

  if (
    response.status === apiKeyValidationTransport.responseStatuses.success &&
    matchesGeneratedJsonSchema(payload, apiKeyValidationSuccessSchema)
  ) {
    return payload
  }

  const message = matchesGeneratedJsonSchema(payload, apiKeyValidationFailureSchema)
    ? payload.error
    : text.length > 0
      ? text
      : `API error (${response.status})`

  if (!response.ok || response.status === apiKeyValidationTransport.responseStatuses.invalid) {
    throw new Error(message)
  }

  throw new Error(`Outlit returned an unexpected API key validation response (${response.status})`)
}

/**
 * Validates an API key by making a lightweight ping call.
 * Exits with invalid_key on failure.
 */
export async function validateKeyOrExit(
  apiKey: string,
  json: boolean,
): Promise<ApiKeyValidationPayload> {
  try {
    return await pingApiKey(apiKey)
  } catch (err) {
    if (isApiKeyValidationUnavailableError(err)) {
      return outputError(
        {
          message: "Outlit cannot validate API keys right now. Please try again shortly.",
          code: "api_unavailable",
        },
        json,
      )
    }

    return outputError(
      {
        message: `API key is invalid or expired: ${errorMessage(err, "unknown error")}`,
        code: "invalid_key",
      },
      json,
    )
  }
}

/**
 * Preserves Core's stable gateway error envelope while keeping untyped failures behind a
 * caller-owned, non-sensitive fallback message.
 */
export function outputApiError(
  error: unknown,
  json: boolean,
  fallback: { message: string; code?: string },
): never {
  if (isOutlitToolsApiError(error) && error.envelope) {
    if (isJsonMode(json)) {
      process.stderr.write(`${JSON.stringify(error.envelope, null, 2)}\n`)
      process.exit(1)
    }

    return outputError({ message: error.envelope.message, code: error.envelope.code }, json)
  }

  return outputError(fallback, json)
}

/** Renders API response data as a TTY table with optional pagination hint. */
function renderApiTable(data: unknown, table: NonNullable<RunToolOptions["table"]>): void {
  const record =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const itemsKey = table.itemsKey ?? "items"
  const rawItems = readPath(record, itemsKey)
  const items = Array.isArray(rawItems) ? (rawItems as Array<Record<string, unknown>>) : undefined

  if (!items || items.length === 0) {
    console.log("(no results)")
    return
  }

  const headers = table.columns.map((c) => c.header)
  const rows = items.map((item) =>
    table.columns.map((col) => {
      const raw = item[col.key]
      return col.format ? col.format(raw) : raw == null ? "--" : String(raw)
    }),
  )

  console.log(renderTable(headers, rows))

  const pagination = readPath(record, table.paginationKey ?? "pagination") as
    | { hasMore: boolean; nextCursor: string | null; total?: number }
    | undefined
  if (pagination) {
    const hint = renderPaginationHint(pagination, items.length)
    if (hint) console.log(`\n${hint}`)
  }
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  let current: unknown = record

  for (const part of path.split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Calls a Platform API endpoint by tool name, writes the result, and exits on API error.
 *
 * When `opts.spinnerMessage` is provided, shows a braille spinner during the call.
 * When `opts.table` is provided and output is interactive, renders a table.
 * Otherwise, falls through to `outputResult` (JSON).
 */
export async function runTool<TToolName extends CliToolName>(
  client: OutlitClient,
  toolName: TToolName,
  params: OutlitToolParams<TToolName>,
  json: boolean,
  opts?: RunToolOptions,
): Promise<void> {
  const spinner = opts?.spinnerMessage ? createSpinner(opts.spinnerMessage) : null

  try {
    const rawData = await client.callTool(toolName, params)
    const data = opts?.transform ? opts.transform(rawData) : rawData
    spinner?.stop("Done")

    const table = opts?.table
    if (isJsonMode(json) || !table) {
      return outputResult(data)
    }

    renderApiTable(data, table)
  } catch (err) {
    spinner?.fail("Failed")
    return outputApiError(err, json, {
      message: errorMessage(err, "Request failed"),
      code: "api_error",
    })
  }
}
