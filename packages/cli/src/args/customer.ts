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

/**
 * Reads the customer from `<customer>`, `--customer`, or `--customer-id`. Giving more than one
 * is fine only when they agree. A supplied but blank customer is an error, never "all customers".
 */
export function readCustomerSelector(
  args: CustomerSelectorArgs,
  json: boolean,
): string | undefined {
  const given: Array<{ source: string; value: string }> = []
  for (const [source, value] of [
    ["<customer>", args.customerPositional],
    ["--customer", args.customer],
    ["--customer-id", args["customer-id"]],
  ] as const) {
    if (value === undefined) continue
    const trimmed = typeof value === "string" ? value.trim() : ""
    if (!trimmed) {
      return outputError(
        { message: `${source} needs a customer domain, name, or ID`, code: "invalid_input" },
        json,
      )
    }
    given.push({ source, value: trimmed })
  }

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
  // Only a selector with a dot or an @ can be a domain (individual customers use their email).
  const couldBeDomain = /[.@]/.test(selector)
  // Keyed by ID so a customer repeated across pages is not counted twice.
  const named = new Map<string, CustomerCandidate>()
  const close: CustomerCandidate[] = []
  let exhausted = false
  let cursor: string | null = null
  // Each page is a billed API call, so stop as soon as the answer is known.
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
    for (const item of items) {
      // A domain is unique in a workspace, so an exact domain decides the lookup.
      if (item.domain?.toLowerCase() === wanted) return item.id
      if (item.name?.trim().toLowerCase() === wanted) named.set(item.id, item)
      else if (close.length < 5 && !close.some((candidate) => candidate.id === item.id)) {
        close.push(item)
      }
    }
    cursor = nextCursor
    if (!cursor) {
      exhausted = true
      break
    }
    // Two exact names are already ambiguous, unless a later page could still hold the domain.
    if (named.size > 1 && !couldBeDomain) break
  }

  const matches = [...named.values()]
  // A single name is only unique once every match has been seen.
  if (matches.length === 1 && exhausted) return (matches[0] as CustomerCandidate).id

  if (matches.length > 1 || !exhausted) {
    const listed = matches.slice(0, MAX_LISTED_CANDIDATES)
    const head =
      matches.length > 1
        ? `"${selector}" matches ${exhausted ? "" : "at least "}${matches.length} customers: ${listed
            .map(describeCandidate)
            .join("; ")}.`
        : `Too many customers match "${selector}" to confirm one by name.`
    return outputError(
      {
        message: `${head} Pass the domain or ID instead.`,
        code: "ambiguous_customer",
        ...(listed.length > 0 ? { details: { candidates: listed } } : {}),
      },
      json,
    )
  }

  return outputError(
    {
      message: `No customer has the domain or exact name "${selector}".${
        close.length > 0 ? ` Close matches: ${close.map(describeCandidate).join("; ")}.` : ""
      }`,
      code: "customer_not_found",
      ...(close.length > 0 ? { details: { candidates: close } } : {}),
    },
    json,
  )
}
