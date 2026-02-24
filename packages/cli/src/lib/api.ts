import type { OutlitClient } from "./client"
import { createClient } from "./client"
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
    /** Key path to the items array in the response (default: "items"). */
    itemsKey?: string
  }
  /** Spinner message shown during the API call (TTY only). */
  spinnerMessage?: string
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
export async function pingApiKey(apiKey: string): Promise<void> {
  const client = await createClient(apiKey)
  await client.callTool("outlit_list_customers", { limit: 1 })
}

/**
 * Validates an API key by making a lightweight ping call.
 * Exits with invalid_key on failure.
 */
export async function validateKeyOrExit(apiKey: string, json: boolean): Promise<void> {
  try {
    await pingApiKey(apiKey)
  } catch (err) {
    return outputError(
      {
        message: `API key is invalid or expired: ${errorMessage(err, "unknown error")}`,
        code: "invalid_key",
      },
      json,
    )
  }
}

/** Renders API response data as a TTY table with optional pagination hint. */
function renderApiTable(data: unknown, table: NonNullable<RunToolOptions["table"]>): void {
  const record =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const itemsKey = table.itemsKey ?? "items"
  const rawItems = record[itemsKey]
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

  const pagination = record.pagination as
    | { hasMore: boolean; nextCursor: string | null; total: number }
    | undefined
  if (pagination) {
    const hint = renderPaginationHint(pagination, items.length)
    if (hint) console.log(`\n${hint}`)
  }
}

/**
 * Calls a Platform API endpoint by tool name, writes the result, and exits on API error.
 *
 * When `opts.spinnerMessage` is provided, shows a braille spinner during the call.
 * When `opts.table` is provided and output is interactive, renders a table.
 * Otherwise, falls through to `outputResult` (JSON).
 */
export async function runTool(
  client: OutlitClient,
  toolName: string,
  params: Record<string, unknown>,
  json: boolean,
  opts?: RunToolOptions,
): Promise<void> {
  const spinner = opts?.spinnerMessage ? createSpinner(opts.spinnerMessage) : null

  try {
    const data = await client.callTool(toolName, params)
    spinner?.stop("Done")

    const table = opts?.table
    if (isJsonMode(json) || !table) {
      return outputResult(data)
    }

    renderApiTable(data, table)
  } catch (err) {
    spinner?.fail("Failed")
    return outputError({ message: errorMessage(err, "Request failed"), code: "api_error" }, json)
  }
}
