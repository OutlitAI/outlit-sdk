import { publicToolContracts } from "@outlit/tools"
import { outputError } from "../../lib/output"

const fieldSources: readonly string[] =
  publicToolContracts.outlit_get_customer.inputSchema.properties.fields.items.properties.source.enum

export type FieldSelector = { source?: string; key: string }

/**
 * The CRM fields to read from `--fields hs_lead_status,salesforce:Type`: a key or label, optionally
 * with the system that holds it in front (`hubspot:`, `salesforce:`, ...). A colon that does not follow
 * a system name belongs to the key.
 */
export function parseFieldSelectors(value: string, json: boolean): FieldSelector[] {
  const selectors = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): FieldSelector => {
      const colon = part.indexOf(":")
      const source = colon === -1 ? "" : part.slice(0, colon).trim().toLowerCase()
      if (fieldSources.includes(source) && part.slice(colon + 1).trim()) {
        return { source, key: part.slice(colon + 1).trim() }
      }
      return { key: part }
    })
  if (selectors.length === 0) {
    return outputError(
      { message: "--fields needs at least one field key", code: "invalid_input" },
      json,
    )
  }
  return selectors
}

/**
 * The CRM account whose contacts to read, from `--crm-contacts <connectionId>:<accountId>` (the
 * connectionId and accountId `include crm` returns), with the `--cursor` that continues it.
 */
export function parseCrmContacts(
  value: string,
  cursor: string | undefined,
  json: boolean,
): { connectionId: string; accountId: string; cursor?: string } {
  const colon = value.indexOf(":")
  const connectionId = colon === -1 ? "" : value.slice(0, colon).trim()
  const accountId = colon === -1 ? "" : value.slice(colon + 1).trim()
  if (!(connectionId && accountId)) {
    return outputError(
      {
        message: "--crm-contacts must be <connectionId>:<accountId>, as `include crm` returns them",
        code: "invalid_input",
      },
      json,
    )
  }
  return { connectionId, accountId, ...(cursor ? { cursor } : {}) }
}
