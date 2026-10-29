import { publicToolContracts } from "@outlit/tools"
import type { ArgsDef } from "citty"
import { outputApiError } from "../lib/api"
import type { OutlitClient } from "../lib/client"
import { outputError } from "../lib/output"
import { hiddenArg, labeledPositional } from "../lib/strict-args"

export const CUSTOMER_SELECTOR_HINT = "Customer domain (acme.com), exact name, or ID"

/** The one customer selector: `--customer`. `--customer-id` stays as a hidden alias. */
export const customerFlagArgs = {
  customer: {
    type: "string",
    description: CUSTOMER_SELECTOR_HINT,
  },
  "customer-id": hiddenArg({
    type: "string",
    description: "Compatibility alias for --customer",
  }),
} satisfies ArgsDef

/** `<customer>` positional plus the `--customer` flag, for commands about one customer. */
export const customerArgs = {
  customerPositional: labeledPositional("customer", {
    type: "positional",
    description: `${CUSTOMER_SELECTOR_HINT}; same as --customer`,
    required: false,
  }),
  ...customerFlagArgs,
} satisfies ArgsDef

type CustomerSelectorArgs = {
  customerPositional?: unknown
  customer?: unknown
  "customer-id"?: unknown
}

function selectorValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Reads the customer from `<customer>`, `--customer`, or `--customer-id`. Giving more than one
 * is fine only when they agree.
 */
export function readCustomerSelector(
  args: CustomerSelectorArgs,
  json: boolean,
): string | undefined {
  const given = [
    { source: "<customer>", value: selectorValue(args.customerPositional) },
    { source: "--customer", value: selectorValue(args.customer) },
    { source: "--customer-id", value: selectorValue(args["customer-id"]) },
  ].filter((entry): entry is { source: string; value: string } => entry.value !== undefined)

  const distinct = [...new Set(given.map((entry) => entry.value))]
  if (distinct.length > 1) {
    return outputError(
      {
        message: `Give one customer; got ${given
          .map((entry) => `${entry.source} ${entry.value}`)
          .join(" and ")}`,
        code: "invalid_input",
      },
      json,
    )
  }

  return distinct[0]
}

export function requireCustomerSelector(
  args: CustomerSelectorArgs,
  command: string,
  json: boolean,
): string {
  const customer = readCustomerSelector(args, json)
  if (customer) return customer

  return outputError(
    {
      message: `Provide a customer: \`${command} <customer>\` or \`${command} --customer <domain|name|id>\``,
      code: "missing_input",
    },
    json,
  )
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEARCH_PAGE_LIMIT = 100
const SEARCH_MAX_PAGES = 10
const MAX_LISTED_CANDIDATES = 10

type CustomerCandidate = { id: string; name: string | null; domain: string | null }

function readCandidates(page: unknown): {
  items: CustomerCandidate[]
  nextCursor: string | null
} {
  const record = typeof page === "object" && page !== null ? (page as Record<string, unknown>) : {}
  const items = Array.isArray(record.items) ? record.items : []
  const pagination =
    typeof record.pagination === "object" && record.pagination !== null
      ? (record.pagination as Record<string, unknown>)
      : {}

  return {
    items: items.flatMap((item): CustomerCandidate[] => {
      if (typeof item !== "object" || item === null) return []
      const candidate = item as Record<string, unknown>
      if (typeof candidate.id !== "string") return []
      return [
        {
          id: candidate.id,
          name: typeof candidate.name === "string" ? candidate.name : null,
          domain: typeof candidate.domain === "string" ? candidate.domain : null,
        },
      ]
    }),
    nextCursor:
      pagination.hasMore === true && typeof pagination.nextCursor === "string"
        ? pagination.nextCursor
        : null,
  }
}

function describeCandidate(candidate: CustomerCandidate): string {
  const label = candidate.name ?? candidate.domain ?? "(unnamed)"
  const domain = candidate.domain && candidate.domain !== label ? ` (${candidate.domain})` : ""
  return `${label}${domain} ${candidate.id}`
}

/**
 * Turns a customer domain, exact name, or ID into the customer ID, for tools that accept only
 * an ID. A domain is unique in a workspace; a name must match exactly one customer.
 */
export async function resolveCustomerIdOrExit(
  client: OutlitClient,
  selector: string,
  json: boolean,
): Promise<string> {
  if (UUID_REGEX.test(selector)) return selector

  const wanted = selector.toLowerCase()
  const seen: CustomerCandidate[] = []
  let cursor: string | null = null
  for (let page = 0; page < SEARCH_MAX_PAGES; page++) {
    let result: unknown
    try {
      result = await client.callTool(publicToolContracts.outlit_list_customers.toolName, {
        search: selector,
        limit: SEARCH_PAGE_LIMIT,
        orderBy: "name",
        orderDirection: "asc",
        ...(cursor ? { cursor } : {}),
      })
    } catch (error) {
      return outputApiError(error, json, {
        message: `Could not look up customer "${selector}"`,
        code: "api_error",
      })
    }
    const { items, nextCursor } = readCandidates(result)
    seen.push(...items)
    cursor = nextCursor
    if (!cursor) break
  }

  const byDomain = seen.filter((candidate) => candidate.domain?.toLowerCase() === wanted)
  if (byDomain.length === 1) return (byDomain[0] as CustomerCandidate).id

  const exact =
    byDomain.length > 1
      ? byDomain
      : seen.filter((candidate) => candidate.name?.trim().toLowerCase() === wanted)
  if (exact.length === 1) return (exact[0] as CustomerCandidate).id

  if (exact.length > 1) {
    const listed = exact.slice(0, MAX_LISTED_CANDIDATES)
    return outputError(
      {
        message: `"${selector}" matches ${exact.length} customers: ${listed
          .map(describeCandidate)
          .join("; ")}. Pass the domain or ID instead.`,
        code: "ambiguous_customer",
        details: { candidates: listed },
      },
      json,
    )
  }

  const close = seen.slice(0, 5)
  return outputError(
    {
      message: `No customer has the domain or exact name "${selector}".${
        close.length > 0 ? ` Close matches: ${close.map(describeCandidate).join("; ")}.` : ""
      }${cursor ? " The search stopped early; pass the customer ID." : ""}`,
      code: "customer_not_found",
      ...(close.length > 0 ? { details: { candidates: close } } : {}),
    },
    json,
  )
}
