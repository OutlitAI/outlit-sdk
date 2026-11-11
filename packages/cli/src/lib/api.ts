import {
  type ApiKeyValidationSuccess,
  type ApiKeyValidationSuccessV2,
  apiKeyContractHeader,
  apiKeyValidationFailureSchema,
  apiKeyValidationSuccessSchema,
  apiKeyValidationSuccessSchemaV2,
  apiKeyValidationTransport,
  type CliToolName,
  type Collection,
  collectionOf,
  isOutlitToolsApiError,
  matchesGeneratedJsonSchema,
} from "@outlit/tools"
import type { OutlitClient, OutlitToolParams } from "./client"
import { createClient } from "./client"
import { CLI_CLIENT, CLIENT_HEADER } from "./client-id"
import { DEFAULT_API_URL } from "./config"
import { envelopeLines } from "./error-lines"
import { warnIfKeyExpiresSoon } from "./key-expiry"
import { moreLines, nextCommand } from "./next-command"
import { errorMessage, isJsonMode, outputError, outputResult } from "./output"
import { createSpinner } from "./spinner"
import { renderPaginationHint, renderTable } from "./table"

export interface TableColumn {
  header: string
  /** Property of each item; a dot-separated path reads a nested one (`source.type`). */
  key: string
  format?: (value: unknown) => string
  /** Shown only when at least one row has a value here (a column some calls add to every row). */
  optional?: boolean
}

export interface RunToolOptions {
  /** Column definitions for TTY table rendering. */
  table?: {
    columns: TableColumn[]
  }
  /** Spinner message shown during the API call (TTY only). */
  spinnerMessage?: string
  /** Optional response normalization before JSON/table output. */
  transform?: (data: unknown) => unknown
}

/** v2 when the server knows the contract (it then says when the key expires), v1 otherwise. */
export type ApiKeyValidationPayload = ApiKeyValidationSuccess | ApiKeyValidationSuccessV2

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
      [CLIENT_HEADER]: CLI_CLIENT,
      // Ask for v2 (adds the key's expiry); a server that predates it answers v1.
      [apiKeyContractHeader]: "2",
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

  if (response.status === apiKeyValidationTransport.responseStatuses.success) {
    if (matchesGeneratedJsonSchema(payload, apiKeyValidationSuccessSchemaV2)) {
      warnIfKeyExpiresSoon(payload.apiKey?.expiresAt)
      return payload
    }
    if (matchesGeneratedJsonSchema(payload, apiKeyValidationSuccessSchema)) return payload
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

    return outputError(
      {
        message: [error.envelope.message, ...envelopeLines(error.envelope)].join("\n"),
        code: error.envelope.code,
      },
      json,
    )
  }

  return outputError(fallback, json)
}

/** Renders API response data as a TTY table with optional pagination hint. */
function renderApiTable(
  toolName: string,
  data: unknown,
  table: NonNullable<RunToolOptions["table"]>,
): void {
  const record =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  // The tool's own collection key (items, facts, events, results), page and truncation.
  const collection = collectionOf(toolName, data)
  const items = collection?.items as Array<Record<string, unknown>> | undefined

  if (!items || items.length === 0) {
    console.log("(no results)")
    // An empty v2 list says what it searched, so "nothing found" is not read as "not looked".
    const searched = readPath(record, "coverage.searched")
    if (typeof searched === "string" && searched.length > 0) console.log(`Searched: ${searched}`)
    const notes = coverageNotes(readPath(record, "coverage"))
    if (notes) console.log(notes)
    return
  }

  const columns = table.columns.filter(
    (col) => !col.optional || items.some((item) => readPath(item, col.key) != null),
  )
  const headers = columns.map((c) => c.header)
  const rows = items.map((item) =>
    columns.map((col) => {
      const raw = readPath(item, col.key)
      return col.format ? col.format(raw) : raw == null ? "--" : String(raw)
    }),
  )

  console.log(renderTable(headers, rows))

  if (collection?.page) {
    const hint = renderPaginationHint(collection.page, items.length)
    if (hint) console.log(`\n${hint}`)
  }
  const cut = truncationNote(collection?.truncation)
  if (cut) console.log(`\n${cut}`)
  const notes = coverageNotes(readPath(record, "coverage"))
  if (notes) console.log(`\n${notes}`)
}

/** What a list the gateway cut to fit its size cap says: how many rows it kept and how to read the rest. */
function truncationNote(truncation: Collection["truncation"]): string | undefined {
  if (!truncation) return undefined
  const kept = typeof truncation.returned === "number" ? `${truncation.returned} rows kept. ` : ""
  const next = truncation.next
  const how = next ? (nextCommand(next.tool, next.input) ?? next.instruction) : ""
  return `Cut to fit the response size: ${kept}${how}`.trim()
}

/** Customers a credits or meter call could not rank, by why, so a short list is not read as complete. */
function coverageNotes(coverage: unknown): string | undefined {
  if (typeof coverage !== "object" || coverage === null) return undefined
  const { stale, withoutMeter, ambiguous } = coverage as Record<string, unknown>
  const notes: string[] = []
  if (typeof stale === "number" && stale > 0) {
    notes.push(`${stale} left out: Autumn scan over 3 hours old`)
  }
  if (typeof withoutMeter === "number" && withoutMeter > 0) {
    notes.push(`${withoutMeter} left out: no usage for the meter`)
  }
  if (typeof ambiguous === "number" && ambiguous > 0) {
    notes.push(`${ambiguous} left out: email matches several Autumn accounts`)
  }
  return notes.length > 0 ? `Not listed: ${notes.join("; ")}.` : undefined
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
  const spinner =
    opts?.spinnerMessage && !isJsonMode(json) ? createSpinner(opts.spinnerMessage) : null

  try {
    const rawData = await client.callTool(toolName, params)
    const data = opts?.transform ? opts.transform(rawData) : rawData
    spinner?.stop("Done")

    const table = opts?.table
    if (isJsonMode(json) || !table) {
      outputResult(data)
      // JSON readers get `more.next` in the result; a person at a terminal gets the command.
      if (!isJsonMode(json)) {
        for (const line of moreLines(data)) process.stderr.write(`${line}\n`)
      }
      return
    }

    renderApiTable(toolName, data, table)
  } catch (err) {
    spinner?.fail("Failed")
    return outputApiError(err, json, {
      message: errorMessage(err, "Request failed"),
      code: "api_error",
    })
  }
}
